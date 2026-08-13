import * as readingService from '@/server/reading/reading.service';
import * as fsp from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { eq } from 'drizzle-orm';
import { client } from '../setup-e2e-context';
import { auth } from '../mocks/auth.middleware.mock';
import { db } from '@/server/db/db.service';
import { event, file, reading, user } from '@/server/db/db.schema';
import { createFile, createReading } from '@/server/reading/reading.repository';
import { EventType } from '@/const/event';

const USER_ID = 'e2e-test-user';

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

const makeMinimalPdf = () => {
  const objects = [
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<<>>>>endobj\n',
  ];

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += xref;
  body += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, 'latin1');
};

describe('reading.router', () => {
  let mkdirSpy: MockInstance<typeof fsp.mkdir>;
  let writeFileSpy: MockInstance<typeof fsp.writeFile>;

  beforeEach(() => {
    mkdirSpy = vi.spyOn(fsp, 'mkdir').mockResolvedValue(undefined);
    writeFileSpy = vi.spyOn(fsp, 'writeFile').mockResolvedValue(undefined);
  });

  afterEach(() => {
    mkdirSpy.mockRestore();
    writeFileSpy.mockRestore();
  });

  describe('POST /api/v1/users/me/readings', () => {
    it('returns 201, writes the file to the expected path, and records an upload event', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });

      const pdfFile = new File([makeMinimalPdf()], 'My Book.pdf', { type: 'application/pdf' });

      const res = await client.api.v1.users.me.readings.$post({ form: { file: pdfFile, title: 'Custom Title' } });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          userId: USER_ID,
          title: 'Custom Title',
          totalPages: 1,
          currentPage: 0,
          durationMs: 0,
        },
      });

      const createdReading = await db.query.reading.findFirst({ where: eq(reading.userId, USER_ID) });
      expect(createdReading).toBeDefined();

      const createdFile = await db.query.file.findFirst({ where: eq(file.userId, USER_ID) });
      expect(createdFile).toBeDefined();
      expect(writeFileSpy).toHaveBeenCalledWith(
        path.join(readingService.UPLOADS_DIR, USER_ID, `${createdFile!.hash}.pdf`),
        expect.any(Buffer),
      );

      const events = await db.query.event.findMany({ where: eq(event.userId, USER_ID) });
      expect(events).toMatchObject([
        { type: EventType.ReadingUploaded, userId: USER_ID, readingId: createdReading!.id },
      ]);
    });

    it('derives the title from the filename when no title is given', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });

      const pdfFile = new File([makeMinimalPdf()], 'My Book.pdf', { type: 'application/pdf' });

      const res = await client.api.v1.users.me.readings.$post({ form: { file: pdfFile } });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({ success: true, data: { title: 'My Book' } });
    });

    it('returns 400 for a non-PDF mime type, rejected by schema validation before it reaches the service', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const uploadReadingSpy = vi.spyOn(readingService, 'uploadReading');

      const textFile = new File([Buffer.from('hello')], 'notes.txt', { type: 'text/plain' });

      const res = await client.api.v1.users.me.readings.$post({ form: { file: textFile } });
      expect(res.status).toBe(400);
      expect(uploadReadingSpy).not.toHaveBeenCalled();

      uploadReadingSpy.mockRestore();
    });

    it('returns 400 for a file over the size limit, rejected by the body-limit middleware before it reaches the service', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const uploadReadingSpy = vi.spyOn(readingService, 'uploadReading');

      const oversizedFile = new File([Buffer.alloc(21 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });

      const res = await client.api.v1.users.me.readings.$post({ form: { file: oversizedFile } });
      expect(res.status).toBe(400);
      expect(uploadReadingSpy).not.toHaveBeenCalled();

      uploadReadingSpy.mockRestore();
    });

    it('calls the service for an upload within the size limit', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const uploadReadingSpy = vi.spyOn(readingService, 'uploadReading');

      const pdfFile = new File([makeMinimalPdf()], 'My Book.pdf', { type: 'application/pdf' });

      const res = await client.api.v1.users.me.readings.$post({ form: { file: pdfFile } });
      expect(res.status).toBe(201);
      expect(uploadReadingSpy).toHaveBeenCalledOnce();

      uploadReadingSpy.mockRestore();
    });

    it('returns 400 for a corrupt PDF', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });

      const corruptFile = new File([Buffer.from('not a real pdf')], 'fake.pdf', { type: 'application/pdf' });

      const res = await client.api.v1.users.me.readings.$post({ form: { file: corruptFile } });
      expect(res.status).toBe(400);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();

      const pdfFile = new File([makeMinimalPdf()], 'My Book.pdf', { type: 'application/pdf' });

      const res = await client.api.v1.users.me.readings.$post({ form: { file: pdfFile } });
      expect(res.status).toBe(401);
    });

    it('returns 409 when the user uploads the same file again, without writing it to disk again', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });

      const pdfBytes = makeMinimalPdf();
      const firstRes = await client.api.v1.users.me.readings.$post({
        form: { file: new File([pdfBytes], 'My Book.pdf', { type: 'application/pdf' }) },
      });
      expect(firstRes.status).toBe(201);
      expect(writeFileSpy).toHaveBeenCalledOnce();

      const secondRes = await client.api.v1.users.me.readings.$post({
        form: { file: new File([pdfBytes], 'Copy of My Book.pdf', { type: 'application/pdf' }) },
      });
      expect(secondRes.status).toBe(409);
      expect(writeFileSpy).toHaveBeenCalledOnce();

      const readings = await db.query.reading.findMany({ where: eq(reading.userId, USER_ID) });
      expect(readings).toHaveLength(1);
    });

    it('allows different users to upload the same file content', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      await db.insert(user).values({ id: 'other-user', name: 'Other User', email: 'other-user@example.com' });

      const pdfBytes = makeMinimalPdf();
      const firstRes = await client.api.v1.users.me.readings.$post({
        form: { file: new File([pdfBytes], 'My Book.pdf', { type: 'application/pdf' }) },
      });
      expect(firstRes.status).toBe(201);

      auth.authorized({ user: { id: 'other-user' } });
      const secondRes = await client.api.v1.users.me.readings.$post({
        form: { file: new File([pdfBytes], 'My Book.pdf', { type: 'application/pdf' }) },
      });
      expect(secondRes.status).toBe(201);
    });
  });

  describe('GET /api/v1/users/me/readings', () => {
    it('returns the readings newest-first, with pageInfo', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const titles = ['First Book', 'Second Book', 'Third Book'];
      await seedReadings({ userId: USER_ID, titles });

      const res = await client.api.v1.users.me.readings.$get({ query: {} });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.map((item) => item.title)).toEqual([...titles].reverse());
      expect(body.data[0]).toMatchObject({ userId: USER_ID, title: 'Third Book' });
      expect(body.pageInfo).toMatchObject({ total: 3, count: 3 });
      expect(body.pageInfo.nextCursor).toBeUndefined();
    });

    it('paginates readings across pages honoring limit and cursor', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const titles = ['A', 'B', 'C', 'D', 'E'];
      await seedReadings({ userId: USER_ID, titles });
      const newestFirst = [...titles].reverse();

      const firstRes = await client.api.v1.users.me.readings.$get({ query: { limit: '2' } });
      expect(firstRes.status).toBe(200);
      const firstBody = await firstRes.json();
      expect(firstBody.data).toHaveLength(2);
      expect(firstBody.pageInfo).toMatchObject({ total: 5, count: 2 });
      expect(firstBody.pageInfo.nextCursor).toEqual(expect.any(String));

      const secondRes = await client.api.v1.users.me.readings.$get({
        query: { limit: '2', cursor: firstBody.pageInfo.nextCursor },
      });
      expect(secondRes.status).toBe(200);
      const secondBody = await secondRes.json();
      expect(secondBody.data).toHaveLength(2);
      expect(secondBody.pageInfo).toMatchObject({ total: 5, count: 2 });
      expect(secondBody.pageInfo.nextCursor).toEqual(expect.any(String));

      const thirdRes = await client.api.v1.users.me.readings.$get({
        query: { limit: '2', cursor: secondBody.pageInfo.nextCursor },
      });
      expect(thirdRes.status).toBe(200);
      const thirdBody = await thirdRes.json();
      expect(thirdBody.data).toHaveLength(1);
      expect(thirdBody.pageInfo).toMatchObject({ total: 5, count: 1 });
      expect(thirdBody.pageInfo.nextCursor).toBeUndefined();

      const pagedTitles = [...firstBody.data, ...secondBody.data, ...thirdBody.data].map((item) => item.title);
      expect(pagedTitles).toEqual(newestFirst);
    });

    it('returns every reading exactly once when following nextCursor to the end', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const titles = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      await seedReadings({ userId: USER_ID, titles });

      const collected: string[] = [];
      let cursor: string | undefined;

      do {
        const res = await client.api.v1.users.me.readings.$get({
          query: { limit: '3', ...(cursor ? { cursor } : {}) },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.pageInfo.total).toBe(titles.length);
        collected.push(...body.data.map((item) => item.title));
        cursor = body.pageInfo.nextCursor;
      } while (cursor);

      expect(collected).toEqual([...titles].reverse());
      expect(new Set(collected).size).toBe(titles.length);
    });

    it("only returns the authenticated user's readings", async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      await db.insert(user).values({ id: 'other-user', name: 'Other User', email: 'other-user@example.com' });
      await seedReading({ userId: USER_ID, title: 'Mine' });
      await seedReading({ userId: 'other-user', title: 'Not Mine' });

      const res = await client.api.v1.users.me.readings.$get({ query: {} });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.map((item) => item.title)).toEqual(['Mine']);
      expect(body.pageInfo).toMatchObject({ total: 1, count: 1 });
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1.users.me.readings.$get({ query: {} });
      expect(res.status).toBe(401);
    });
  });
});
