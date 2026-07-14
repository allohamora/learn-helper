import handler from '@tanstack/react-start/server-entry';
import { runMigrations } from '@/server/db/db.service';

// https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point#server-configuration
await runMigrations();

export default handler;
