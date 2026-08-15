import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { db } from '@/server/db/db.service';
import { user } from '@/server/db/db.schema';
import { createFile, createReading } from '@/server/reading/reading.repository';
import { downloadReading, getReadingWithFileByIdAndUserIdOrThrow } from '@/server/reading/reading.service';
import { Exception } from '@/server/utils/exception.utils';

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
    let createReadStreamSpy: MockInstance<typeof fs.createReadStream>;

    beforeEach(() => {
      createReadStreamSpy = vi
        .spyOn(fs, 'createReadStream')
        .mockImplementation(() => Readable.from([Buffer.from('pdf-bytes')]) as unknown as fs.ReadStream);
    });

    afterEach(() => {
      createReadStreamSpy.mockRestore();
    });

    it('resolves with the file metadata and a lazy stream getter', async () => {
      await seedUser(USER_ID);
      const created = await seedReading({ userId: USER_ID, title: 'Book' });

      const result = await downloadReading({ userId: USER_ID, readingId: created.id });

      expect(result).toMatchObject({ hash: 'Book', fileName: 'Book.pdf', mimeType: 'application/pdf' });
      expect(createReadStreamSpy).not.toHaveBeenCalled();

      const stream = result.getStream();
      expect(createReadStreamSpy).toHaveBeenCalledWith(path.join(process.cwd(), `uploads/${USER_ID}/Book.pdf`));

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
});
