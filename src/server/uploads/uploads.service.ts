import '@tanstack/react-start/server-only';
import path from 'node:path';
import fs from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createLogger } from '../utils/logger.utils';

const logger = createLogger('uploads.service');

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export const writeUploadFile = async ({
  userId,
  fileName,
  buffer,
}: {
  userId: string;
  fileName: string;
  buffer: Buffer;
}) => {
  const relativePath = path.join('uploads', userId, fileName);
  const absolutePath = path.join(UPLOADS_DIR, userId, fileName);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return relativePath;
};

export const removeUploadFile = async (filePath: string) => {
  // best-effort: callers already committed their DB transaction, so a disk error here shouldn't fail the request
  // TODO: a failure here leaves an orphan file on disk; add a reconciliation job to clean these up if this becomes a problem
  try {
    await rm(path.join(process.cwd(), filePath), { force: true });
  } catch (err) {
    logger.error({ msg: 'failed to remove upload file from disk', err, filePath });
  }
};

export const getUploadFileWebStream = (filePath: string): ReadableStream => {
  return Readable.toWeb(fs.createReadStream(path.join(process.cwd(), filePath))) as unknown as ReadableStream;
};
