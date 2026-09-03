import '@tanstack/react-start/server-only';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { EventType } from '@/const/event';
import type { Transaction } from '../db/db.types';
import { db } from '../db/db.service';
import { insertEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
import { getUploadFileWebStream, removeUploadFile, writeUploadFile } from '../uploads/uploads.service';
import { generateTranslationData } from './reading-translation-generation.service';
import {
  createFile,
  createReading,
  deleteFile,
  getFileByUserIdAndHash,
  getReadingByIdAndUserId,
  getReadingWithFileByIdAndUserId,
  updateReadingState as updateReadingStateInDb,
} from './reading.repository';
import type { TranslateSelectionDto } from './dtos/translate-selection.dto';
import type { UpdateReadingStateDto } from './dtos/update-reading-state.dto';

// Mirrors vocabularyItem.value's column length (src/server/db/db.schema.ts) - the largest a
// selection can be and still become a stored learning item, independent of the translation's own length.
const MAX_LEARNABLE_TEXT_LENGTH = 255;

// pdfjs-dist always runs its "fake worker" in Node, which dynamically imports its default
// workerSrc ("./pdf.worker.mjs") relative to the bundled pdfjs-dist module - a path our SSR
// build doesn't emit. Point it at the real file shipped in node_modules instead.
GlobalWorkerOptions.workerSrc = createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

const getPdfPageCount = async (buffer: Buffer) => {
  try {
    const document = await getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;

    return document.numPages;
  } catch (err) {
    throw Exception.badRequest('Invalid or corrupted PDF file', { cause: err });
  }
};

export const uploadReading = async ({ userId, file, title }: { userId: string; file: File; title: string }) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash('sha256').update(buffer).digest('hex');

  if (await getFileByUserIdAndHash({ userId, hash })) {
    throw Exception.conflict('This file was already uploaded');
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
  if (!found) throw Exception.notFound('Reading not found');

  return found;
};

export const getReadingWithFileByIdAndUserIdOrThrow = async (
  { userId, readingId }: { userId: string; readingId: string },
  tx: Transaction = db,
) => {
  const found = await getReadingWithFileByIdAndUserId({ userId, readingId }, tx);
  if (!found) throw Exception.notFound('Reading not found');

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

export const updateReadingState = async ({
  userId,
  readingId,
  currentPage,
  addDurationMs,
}: UpdateReadingStateDto & { userId: string; readingId: string }) => {
  return db.transaction(async (tx) => {
    await getReadingByIdAndUserIdOrThrow({ userId, readingId }, tx);

    const [updated] = await Promise.all([
      updateReadingStateInDb({ userId, readingId, currentPage, addDurationMs }, tx),
      insertEvent(
        { type: EventType.ReadingTimeSpent, userId, readingId, durationMs: addDurationMs, metadata: { currentPage } },
        tx,
      ),
    ]);

    return updated;
  });
};

export const translateReadingSelection = async ({
  userId,
  readingId,
  ...data
}: TranslateSelectionDto & { userId: string; readingId: string }) => {
  await getReadingByIdAndUserIdOrThrow({ userId, readingId });

  const { output, cost } = await generateTranslationData(data);

  await insertEvent({
    type: EventType.ReadingSelectionTranslationGenerated,
    userId,
    readingId,
    costInNanoDollars: cost.costInNanoDollars,
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
    metadata: { input: data, output },
  });

  return {
    uaTranslation: output.uaTranslation,
    canAddToLearningList: data.text.length <= MAX_LEARNABLE_TEXT_LENGTH && output.isLearnable,
  };
};
