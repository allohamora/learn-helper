import type { FC } from 'react';
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { appClient } from '@/services/api';

const PDF_MIME_TYPE = 'application/pdf';
const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

const fileSchema = z
  .instanceof(File, { message: 'Select a PDF file.' })
  .refine((file) => file.type === PDF_MIME_TYPE, 'Only PDF files are supported.')
  .refine((file) => file.size <= MAX_UPLOAD_SIZE_BYTES, 'File exceeds the 20MB limit.');

type FormValues = {
  file: File | null;
  title: string;
};

export const UploadReadingDialog: FC = () => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      const res = await appClient.api.v1.users.me.readings.$post({
        form: { file, title: title.trim() || undefined },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body && 'error' in body ? body.error.messages.join(', ') : 'Failed to upload reading');
      }

      return res.json();
    },
    onSuccess: () => {
      setOpen(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['readings'] });
      toast.success('Reading uploaded');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to upload reading'),
  });

  const form = useForm({
    defaultValues: { file: null, title: '' } as FormValues,
    onSubmit: async ({ value }) => {
      if (!value.file) return;
      await uploadMutation.mutateAsync({ file: value.file, title: value.title });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="size-8 px-0 sm:w-auto sm:px-2.5"
          title="Upload reading"
          aria-label="Upload reading"
        >
          <Upload />
          <span className="hidden sm:inline">Upload</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload reading</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="file" validators={{ onChange: fileSchema, onSubmit: fileSchema }}>
            {(field) => (
              <div className="space-y-1">
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => field.handleChange(e.target.files?.[0] ?? null)}
                  autoFocus
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">{String(field.state.meta.errors[0])}</p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="title">
            {(field) => (
              <Input
                placeholder="Title"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          </form.Field>

          <form.Subscribe selector={(state) => [state.isSubmitting] as const}>
            {([isSubmitting]) => (
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Uploading…' : 'Upload'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
};
