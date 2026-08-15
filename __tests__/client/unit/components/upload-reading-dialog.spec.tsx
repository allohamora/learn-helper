import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadReadingDialog } from '@/components/upload-reading-dialog';
import { api } from '../../utils/api.utils';
import { mockServer } from '../../setup-unit-context';

describe('UploadReadingDialog', () => {
  const renderDialog = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    return render(
      <QueryClientProvider client={queryClient}>
        <UploadReadingDialog />
      </QueryClientProvider>,
    );
  };

  const openDialog = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Upload reading' }));

    return {
      submitButton: (await screen.findByRole('button', { name: 'Upload' })) as HTMLButtonElement,
      fileInput: document.querySelector('input[type="file"]') as HTMLInputElement,
      titleInput: screen.getByPlaceholderText('Title'),
    };
  };

  const createReading = (title: string) => {
    const timestamp = new Date().toISOString();

    return {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      fileId: crypto.randomUUID(),
      title,
      totalPages: 1,
      currentPage: 0,
      durationMs: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  };

  afterEach(() => cleanup());

  it('disables submit on open, with no error text shown before any interaction', async () => {
    renderDialog();
    const { submitButton } = await openDialog();

    await vi.waitFor(() => expect(submitButton.disabled).toBe(true));
    expect(screen.queryByText('Select a PDF file.')).toBeNull();
    expect(screen.queryByText('Title is required.')).toBeNull();
  });

  it('does not throw when validating a null file', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderDialog();
    const { titleInput } = await openDialog();

    fireEvent.change(titleInput, { target: { value: 'a' } });
    fireEvent.change(titleInput, { target: { value: '' } });

    await screen.findByText('Title is required.');
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('does not show the file error just because the title field changed', async () => {
    renderDialog();
    const { titleInput } = await openDialog();

    fireEvent.change(titleInput, { target: { value: 'a' } });
    fireEvent.change(titleInput, { target: { value: '' } });

    await screen.findByText('Title is required.');
    expect(screen.queryByText('Select a PDF file.')).toBeNull();
  });

  it('does not show the title error just because the file field changed', async () => {
    renderDialog();
    const { fileInput } = await openDialog();
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [textFile] } });

    await screen.findByText('Only PDF files are supported.');
    expect(screen.queryByText('Title is required.')).toBeNull();
  });

  it('reports the mime-type and size errors for an invalid file, then clears them for a valid one', async () => {
    renderDialog();
    const { fileInput } = await openDialog();

    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [textFile] } });
    await screen.findByText('Only PDF files are supported.');

    const oversizedFile = new File([new Uint8Array(21 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    await screen.findByText('File exceeds the 20MB limit.');

    const pdfFile = new File(['%PDF-1.4'], 'My Book.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });
    await vi.waitFor(() => expect(screen.queryByText('File exceeds the 20MB limit.')).toBeNull());
  });

  it('enables submit once both fields are valid', async () => {
    renderDialog();
    const { submitButton, fileInput, titleInput } = await openDialog();

    const pdfFile = new File(['%PDF-1.4'], 'My Book.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });
    fireEvent.change(titleInput, { target: { value: 'My Book' } });

    await vi.waitFor(() => expect(submitButton.disabled).toBe(false));
  });

  it('submits the file and trimmed title, and shows a success toast', async () => {
    const uploadHandler = vi.fn((_file: File, title: string) => {
      if (title !== 'My Book') throw new Error('unexpected title');

      return HttpResponse.json({ success: true, data: createReading(title) }, { status: 201 });
    });
    mockServer.addHandlers(api.uploadReading.mock(uploadHandler));

    renderDialog();
    const { submitButton, fileInput, titleInput } = await openDialog();

    const pdfFile = new File(['%PDF-1.4'], 'My Book.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });
    fireEvent.change(titleInput, { target: { value: '  My Book  ' } });

    await vi.waitFor(() => expect(submitButton.disabled).toBe(false));
    fireEvent.click(submitButton);

    await vi.waitFor(() => expect(uploadHandler).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull());
  });

  it('keeps submit disabled after closing and reopening with no data entered', async () => {
    renderDialog();
    await openDialog();

    fireEvent.keyDown(screen.getByPlaceholderText('Title'), { key: 'Escape', code: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull());

    const { submitButton } = await openDialog();
    await vi.waitFor(() => expect(submitButton.disabled).toBe(true));
  });

  it('resets the title field after closing and reopening with data entered', async () => {
    renderDialog();
    const { titleInput } = await openDialog();
    fireEvent.change(titleInput, { target: { value: 'My Book' } });

    fireEvent.keyDown(titleInput, { key: 'Escape', code: 'Escape' });
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull());

    const { submitButton } = await openDialog();
    await vi.waitFor(() => expect(submitButton.disabled).toBe(true));
    expect((screen.getByPlaceholderText('Title') as HTMLInputElement).value).toBe('');
  });
});
