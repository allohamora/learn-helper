import { describe, it } from 'vitest';
import { runMigrations } from '@/server/db/db.service';

describe('runMigrations', () => {
  it('is safe to call concurrently, as multiple app replicas would on boot', async () => {
    await Promise.all([runMigrations(), runMigrations(), runMigrations(), runMigrations(), runMigrations()]);
  });
});
