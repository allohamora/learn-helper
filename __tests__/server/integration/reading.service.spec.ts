import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/db.service';
import { user } from '@/server/db/db.schema';
import { createFile, createReading } from '@/server/reading/reading.repository';
import { getReadingWithFileByIdAndUserIdOrThrow } from '@/server/reading/reading.service';
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
