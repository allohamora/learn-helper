import '@tanstack/react-start/server-only';
import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { EventType } from '@/const/event';
import type { Transaction } from '../db/db.types';
import { db } from '../db/db.service';
import { insertEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
import { createLogger } from '../utils/logger.utils';
import { getUploadFileWebStream, removeUploadFile, writeUploadFile } from '../uploads/uploads.service';
import {
  createFile,
  createReading,
  deleteFile,
  getFileByUserIdAndHash,
  getReadingByIdAndUserId,
  getReadingWithFileByIdAndUserId,
} from './reading.repository';

const logger = createLogger('reading.service');

const getPdfPageCount = async (buffer: Buffer) => {
  try {
    const document = await getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;

    return document.numPages;
  } catch (err) {
    logger.error({ err });

    throw Exception.badRequest('invalid or corrupted PDF file');
  }
};

export const uploadReading = async ({ userId, file, title }: { userId: string; file: File; title: string }) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash('sha256').update(buffer).digest('hex');

  if (await getFileByUserIdAndHash({ userId, hash })) {
    throw Exception.conflict('this file was already uploaded');
  }

  const totalPages = await getPdfPageCount(buffer);

  const fileName = `${hash}.pdf`;
  const filePath = await writeUploadFile({ userId, fileName, buffer });

  return await db.transaction(async (tx) => {
    const createdFile = await createFile(
      { userId, fileName, filePath, mimeType: file.type, sizeBytes: file.size, hash },
      tx,
    );

    const createdReading = await createReading({ userId, fileId: createdFile.id, title, totalPages }, tx);

    await insertEvent({ type: EventType.ReadingUploaded, userId, readingId: createdReading.id }, tx);

    return createdReading;
  });
};

export const getReadingByIdAndUserIdOrThrow = async (
  { userId, readingId }: { userId: string; readingId: string },
  tx: Transaction = db,
) => {
  const found = await getReadingByIdAndUserId({ userId, readingId }, tx);
  if (!found) throw Exception.notFound('reading not found');

  return found;
};

export const getReadingWithFileByIdAndUserIdOrThrow = async (
  { userId, readingId }: { userId: string; readingId: string },
  tx: Transaction = db,
) => {
  const found = await getReadingWithFileByIdAndUserId({ userId, readingId }, tx);
  if (!found) throw Exception.notFound('reading not found');

  return found;
};

export const downloadReading = async ({ userId, readingId }: { userId: string; readingId: string }) => {
  const { file } = await getReadingWithFileByIdAndUserIdOrThrow({ userId, readingId });

  return { ...file, getStream: () => getUploadFileWebStream(file.filePath) };
};

export const removeReading = async ({ userId, readingId }: { userId: string; readingId: string }) => {
  const filePath = await db.transaction(async (tx) => {
    const found = await getReadingWithFileByIdAndUserIdOrThrow({ userId, readingId }, tx);

    await deleteFile(found.fileId, tx);
    await insertEvent({ type: EventType.ReadingDeleted, userId }, tx);

    return found.file.filePath;
  });

  await removeUploadFile(filePath);
};
