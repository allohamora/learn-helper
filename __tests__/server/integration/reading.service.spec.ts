import * as readingTranslationGenerationService from '@/server/reading/reading-translation-generation.service';
import * as fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/db.service';
import { event, user } from '@/server/db/db.schema';
import { createFile, createReading } from '@/server/reading/reading.repository';
import {
  downloadReading,
  getReadingByIdAndUserIdOrThrow,
  getReadingWithFileByIdAndUserIdOrThrow,
  translateReadingSelection,
} from '@/server/reading/reading.service';
import { Exception } from '@/server/utils/exception.utils';
import { EventType } from '@/const/event';

const USER_ID = 'reading-service-user';

const seedUser = async (userId: string) => {
  await db.insert(user).values({ id: userId, name: `Test User ${userId}`, email: `${userId}@example.com` });
};

const seedReading = async ({ userId, title }: { userId: string; title: string }) => {
  const createdFile = await createFile({
    userId,
    fileName: `${title}.pdf`,
    filePath: `uploads/${userId}/${title}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 1,
    hash: title,
  });

  return createReading({ userId, fileId: createdFile.id, title, totalPages: 1 });
};

describe('reading.service', () => {
  describe('downloadReading', () => {
    let openSpy: MockInstance<typeof fsp.open>;

    beforeEach(() => {
      openSpy = vi.spyOn(fsp, 'open').mockResolvedValue({
        createReadStream: () => Readable.from([Buffer.from('pdf-bytes')]),
      } as unknown as fsp.FileHandle);
    });

    afterEach(() => {
      openSpy.mockRestore();
    });

    it('resolves with the file metadata and a lazy stream getter', async () => {
      await seedUser(USER_ID);
      const created = await seedReading({ userId: USER_ID, title: 'Book' });

      const result = await downloadReading({ userId: USER_ID, readingId: created.id });

      expect(result).toMatchObject({ hash: 'Book', fileName: 'Book.pdf', mimeType: 'application/pdf' });
      expect(openSpy).not.toHaveBeenCalled();

      const stream = await result.getStream();
      expect(openSpy).toHaveBeenCalledWith(path.join(process.cwd(), `uploads/${USER_ID}/Book.pdf`), 'r');

      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        chunks.push(chunk.value);
      }
      expect(Buffer.concat(chunks).toString()).toBe('pdf-bytes');
    });

    it("throws not found for another user's reading", async () => {
      await seedUser(USER_ID);
      await seedUser('other-user');
      const created = await seedReading({ userId: 'other-user', title: 'Not Mine' });

      await expect(downloadReading({ userId: USER_ID, readingId: created.id })).rejects.toThrow(Exception);
    });

    it('throws not found for an unknown reading id', async () => {
      await seedUser(USER_ID);

      await expect(
        downloadReading({ userId: USER_ID, readingId: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toThrow(Exception);
    });
  });

  describe('getReadingByIdAndUserIdOrThrow', () => {
    it('resolves with the reading without a file field when owned by the user', async () => {
      await seedUser(USER_ID);
      const created = await seedReading({ userId: USER_ID, title: 'Book' });

      const result = await getReadingByIdAndUserIdOrThrow({ userId: USER_ID, readingId: created.id });

      expect(result).toMatchObject({ id: created.id, title: 'Book' });
      expect(result).not.toHaveProperty('file');
    });

    it("throws not found for another user's reading", async () => {
      await seedUser(USER_ID);
      await seedUser('other-user');
      const created = await seedReading({ userId: 'other-user', title: 'Not Mine' });

      await expect(getReadingByIdAndUserIdOrThrow({ userId: USER_ID, readingId: created.id })).rejects.toThrow(
        Exception,
      );
    });

    it('throws not found for an unknown reading id', async () => {
      await seedUser(USER_ID);

      await expect(
        getReadingByIdAndUserIdOrThrow({ userId: USER_ID, readingId: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toThrow(Exception);
    });
  });

  describe('getReadingWithFileByIdAndUserIdOrThrow', () => {
    it('resolves with the reading and its joined file when owned by the user', async () => {
      await seedUser(USER_ID);
      const created = await seedReading({ userId: USER_ID, title: 'Book' });

      const result = await getReadingWithFileByIdAndUserIdOrThrow({ userId: USER_ID, readingId: created.id });

      expect(result).toMatchObject({ id: created.id, title: 'Book' });
      expect(result.file).toMatchObject({ id: created.fileId, hash: 'Book' });
    });

    it("throws not found for another user's reading", async () => {
      await seedUser(USER_ID);
      await seedUser('other-user');
      const created = await seedReading({ userId: 'other-user', title: 'Not Mine' });

      await expect(getReadingWithFileByIdAndUserIdOrThrow({ userId: USER_ID, readingId: created.id })).rejects.toThrow(
        Exception,
      );
    });

    it('throws not found for an unknown reading id', async () => {
      await seedUser(USER_ID);

      await expect(
        getReadingWithFileByIdAndUserIdOrThrow({ userId: USER_ID, readingId: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toThrow(Exception);
    });
  });

  describe('translateReadingSelection', () => {
    let generateSpy: MockInstance<typeof readingTranslationGenerationService.generateTranslationData>;

    beforeEach(() => {
      generateSpy = vi.spyOn(readingTranslationGenerationService, 'generateTranslationData');
    });

    afterEach(() => {
      generateSpy.mockRestore();
    });

    it('returns the translation and logs a cost event tied to the reading', async () => {
      await seedUser(USER_ID);
      const reading = await seedReading({ userId: USER_ID, title: 'Book' });
      generateSpy.mockResolvedValue({
        output: { uaTranslation: 'бігти', isLearnable: true },
        cost: { costInNanoDollars: 1_000_000, inputTokens: 100, outputTokens: 200 },
      });

      const result = await translateReadingSelection({ userId: USER_ID, readingId: reading.id, text: 'run' });

      expect(result).toEqual({ uaTranslation: 'бігти', canAddToLearningList: true });

      const events = await db.query.event.findMany({ where: eq(event.userId, USER_ID) });
      expect(events).toEqual([
        expect.objectContaining({
          type: EventType.ReadingSelectionTranslationGenerated,
          readingId: reading.id,
          costInNanoDollars: 1_000_000,
          inputTokens: 100,
          outputTokens: 200,
        }),
      ]);
    });

    it('disallows adding to the learning list when the model marks the selection as not learnable', async () => {
      await seedUser(USER_ID);
      const reading = await seedReading({ userId: USER_ID, title: 'Book' });
      generateSpy.mockResolvedValue({
        output: { uaTranslation: 'переклад речення', isLearnable: false },
        cost: { costInNanoDollars: 1_000_000, inputTokens: 100, outputTokens: 200 },
      });

      const result = await translateReadingSelection({
        userId: USER_ID,
        readingId: reading.id,
        text: 'a full sentence',
      });

      expect(result.canAddToLearningList).toBe(false);
    });

    it('disallows adding to the learning list once the selection exceeds the learnable length, even when the model marks it learnable', async () => {
      await seedUser(USER_ID);
      const reading = await seedReading({ userId: USER_ID, title: 'Book' });
      generateSpy.mockResolvedValue({
        output: { uaTranslation: 'переклад', isLearnable: true },
        cost: { costInNanoDollars: 1_000_000, inputTokens: 100, outputTokens: 200 },
      });

      // MAX_LEARNABLE_TEXT_LENGTH in reading.service.ts is 255, one over it
      const result = await translateReadingSelection({
        userId: USER_ID,
        readingId: reading.id,
        text: 'a'.repeat(256),
      });

      expect(result.canAddToLearningList).toBe(false);
    });

    it('allows adding to the learning list at exactly the max learnable length', async () => {
      await seedUser(USER_ID);
      const reading = await seedReading({ userId: USER_ID, title: 'Book' });
      generateSpy.mockResolvedValue({
        output: { uaTranslation: 'переклад', isLearnable: true },
        cost: { costInNanoDollars: 1_000_000, inputTokens: 100, outputTokens: 200 },
      });

      const result = await translateReadingSelection({
        userId: USER_ID,
        readingId: reading.id,
        text: 'a'.repeat(255),
      });

      expect(result.canAddToLearningList).toBe(true);
    });

    it("throws not found for another user's reading", async () => {
      await seedUser(USER_ID);
      await seedUser('other-user');
      const reading = await seedReading({ userId: 'other-user', title: 'Not Mine' });

      await expect(translateReadingSelection({ userId: USER_ID, readingId: reading.id, text: 'run' })).rejects.toThrow(
        Exception,
      );
    });
  });
});
