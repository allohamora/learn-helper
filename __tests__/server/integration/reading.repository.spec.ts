import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/db.service';
import { reading, user } from '@/server/db/db.schema';
import {
  createFile,
  createReading,
  deleteFile,
  getFileByUserIdAndHash,
  getReadingWithFileByIdAndUserId,
  getReadingsByUserId,
} from '@/server/reading/reading.repository';
import { RequestType } from '@/const/request';

const USER_ID = 'readings-user';

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

const seedReadings = async ({ userId, titles }: { userId: string; titles: string[] }) => {
  const readings = [];
  for (const title of titles) {
    readings.push(await seedReading({ userId, title }));
  }

  return readings;
};

describe('reading.repository', () => {
  describe('getReadingsByUserId', () => {
    it("returns the user's readings newest-first with a total count", async () => {
      await seedUser(USER_ID);
      await seedReadings({ userId: USER_ID, titles: ['First', 'Second', 'Third'] });

      const result = await getReadingsByUserId({ userId: USER_ID });

      expect(result.items.map((item) => item.title)).toEqual(['Third', 'Second', 'First']);
      expect(result.total).toBe(3);
      expect(result.nextCursor).toBeUndefined();
    });

    it('only returns readings for the given user', async () => {
      await seedUser(USER_ID);
      await seedUser('other-user');
      await seedReading({ userId: USER_ID, title: 'Mine' });
      await seedReading({ userId: 'other-user', title: 'Not Mine' });

      const result = await getReadingsByUserId({ userId: USER_ID });

      expect(result.items.map((item) => item.title)).toEqual(['Mine']);
      expect(result.total).toBe(1);
    });

    it('paginates with a cursor and returns nextCursor when more items remain', async () => {
      await seedUser(USER_ID);
      await seedReadings({ userId: USER_ID, titles: ['A', 'B', 'C'] });

      const firstPage = await getReadingsByUserId({ userId: USER_ID, limit: 2 });
      expect(firstPage.items.map((item) => item.title)).toEqual(['C', 'B']);
      expect(firstPage.nextCursor).toBeDefined();
      expect(firstPage.total).toBe(3);

      const secondPage = await getReadingsByUserId({ userId: USER_ID, limit: 2, cursor: firstPage.nextCursor });
      expect(secondPage.items.map((item) => item.title)).toEqual(['A']);
      expect(secondPage.nextCursor).toBeUndefined();
    });

    it('returns an empty page when the user has no readings', async () => {
      await seedUser(USER_ID);

      const result = await getReadingsByUserId({ userId: USER_ID });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('skips the total count query and returns total: 0 when type is Data', async () => {
      await seedUser(USER_ID);
      await seedReadings({ userId: USER_ID, titles: ['A', 'B'] });

      const result = await getReadingsByUserId({ userId: USER_ID, type: RequestType.Data });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(0);
    });
  });

  describe('getFileByUserIdAndHash', () => {
    it("returns the user's file with the given hash", async () => {
      await seedUser(USER_ID);
      await seedReading({ userId: USER_ID, title: 'Book' });

      const result = await getFileByUserIdAndHash({ userId: USER_ID, hash: 'Book' });

      expect(result).toMatchObject({ userId: USER_ID, hash: 'Book' });
    });

    it('returns undefined when the hash belongs to a different user', async () => {
      await seedUser(USER_ID);
      await seedUser('other-user');
      await seedReading({ userId: 'other-user', title: 'Book' });

      const result = await getFileByUserIdAndHash({ userId: USER_ID, hash: 'Book' });

      expect(result).toBeUndefined();
    });

    it('returns undefined when no file has the given hash', async () => {
      await seedUser(USER_ID);

      const result = await getFileByUserIdAndHash({ userId: USER_ID, hash: 'missing' });

      expect(result).toBeUndefined();
    });
  });

  describe('getReadingWithFileByIdAndUserId', () => {
    it('returns the reading with its joined file when owned by the user', async () => {
      await seedUser(USER_ID);
      const created = await seedReading({ userId: USER_ID, title: 'Book' });

      const result = await getReadingWithFileByIdAndUserId({ userId: USER_ID, readingId: created.id });

      expect(result).toMatchObject({ id: created.id, title: 'Book' });
      expect(result?.file).toMatchObject({ id: created.fileId, hash: 'Book' });
    });

    it("returns undefined for another user's reading", async () => {
      await seedUser(USER_ID);
      await seedUser('other-user');
      const created = await seedReading({ userId: 'other-user', title: 'Not Mine' });

      const result = await getReadingWithFileByIdAndUserId({ userId: USER_ID, readingId: created.id });

      expect(result).toBeUndefined();
    });

    it('returns undefined for an unknown reading id', async () => {
      await seedUser(USER_ID);

      const result = await getReadingWithFileByIdAndUserId({
        userId: USER_ID,
        readingId: '00000000-0000-0000-0000-000000000000',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('deleteFile', () => {
    it('deletes the file row and cascades to delete the reading', async () => {
      await seedUser(USER_ID);
      const created = await seedReading({ userId: USER_ID, title: 'Book' });

      await deleteFile(created.fileId);

      const found = await db.query.reading.findFirst({ where: eq(reading.id, created.id) });
      expect(found).toBeUndefined();
    });
  });
});
