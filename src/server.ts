import handler from '@tanstack/react-start/server-entry';
import { runMigrations } from '@/server/db/db.service';

// https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point#server-configuration
// Runs on every boot; safe under multiple replicas via the advisory lock in runMigrations().
await runMigrations();

export default handler;
