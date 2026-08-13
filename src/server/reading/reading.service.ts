import '@tanstack/react-start/server-only';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { EventType } from '@/const/event';
import { db } from '../db/db.service';
import { insertEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
import { createFile, createReading } from './reading.repository';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const getPdfPageCount = async (buffer: Buffer) => {
  try {
    const document = await getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;

    return document.numPages;
  } catch {
    throw Exception.badRequest('invalid or corrupted PDF file');
  }
};

const writePdfFile = async ({ userId, hash, buffer }: { userId: string; hash: string; buffer: Buffer }) => {
  const relativePath = path.join('uploads', userId, `${hash}.pdf`);
  const absolutePath = path.join(UPLOADS_DIR, userId, `${hash}.pdf`);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return relativePath;
};

const stripPdfExtension = (fileName: string) => fileName.replace(/\.pdf$/i, '');

export const uploadReading = async ({ userId, file, title }: { userId: string; file: File; title?: string }) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const totalPages = await getPdfPageCount(buffer);
  const hash = createHash('sha256').update(buffer).digest('hex');
  const filePath = await writePdfFile({ userId, hash, buffer });

  return await db.transaction(async (tx) => {
    const createdFile = await createFile(
      { userId, fileName: file.name, filePath, mimeType: file.type, sizeBytes: file.size, hash },
      tx,
    );

    const createdReading = await createReading(
      { userId, fileId: createdFile.id, title: title ?? stripPdfExtension(file.name), totalPages },
      tx,
    );

    await insertEvent({ type: EventType.ReadingUploaded, userId, readingId: createdReading.id }, tx);

    return createdReading;
  });
};
