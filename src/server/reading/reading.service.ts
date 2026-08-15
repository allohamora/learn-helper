import '@tanstack/react-start/server-only';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { EventType } from '@/const/event';
import type { Transaction } from '../db/db.types';
import { db } from '../db/db.service';
import { insertEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
import { createLogger } from '../utils/logger.utils';
import {
  createFile,
  createReading,
  deleteFile,
  getFileByUserIdAndHash,
  getReadingWithFileByIdAndUserId,
} from './reading.repository';

const logger = createLogger('reading.service');

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

export const uploadReading = async ({ userId, file, title }: { userId: string; file: File; title: string }) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash('sha256').update(buffer).digest('hex');

  if (await getFileByUserIdAndHash({ userId, hash })) {
    throw Exception.conflict('this file was already uploaded');
  }

  const totalPages = await getPdfPageCount(buffer);
  const filePath = await writePdfFile({ userId, hash, buffer });

  return await db.transaction(async (tx) => {
    const createdFile = await createFile(
      { userId, fileName: file.name, filePath, mimeType: file.type, sizeBytes: file.size, hash },
      tx,
    );

    const createdReading = await createReading({ userId, fileId: createdFile.id, title, totalPages }, tx);

    await insertEvent({ type: EventType.ReadingUploaded, userId, readingId: createdReading.id }, tx);

    return createdReading;
  });
};

export const getReadingWithFileByIdAndUserIdOrThrow = async (
  { userId, readingId }: { userId: string; readingId: string },
  tx: Transaction = db,
) => {
  const found = await getReadingWithFileByIdAndUserId({ userId, readingId }, tx);
  if (!found) throw Exception.notFound('reading not found');

  return found;
};

export const removeReading = async ({ userId, readingId }: { userId: string; readingId: string }) => {
  const filePath = await db.transaction(async (tx) => {
    const found = await getReadingWithFileByIdAndUserIdOrThrow({ userId, readingId }, tx);

    await deleteFile(found.fileId, tx);
    await insertEvent({ type: EventType.ReadingDeleted, userId }, tx);

    return found.file.filePath;
  });

  // best-effort: the DB transaction already committed, so a disk error here shouldn't fail the request
  try {
    await rm(path.join(process.cwd(), filePath), { force: true });
  } catch (err) {
    logger.error({ msg: 'failed to remove reading file from disk', err, filePath });
  }
};
