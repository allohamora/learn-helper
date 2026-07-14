import handler from '@tanstack/react-start/server-entry';
import { runMigrations } from '@/server/db/db.service';

// https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point#server-configuration
// TODO: if we move to a complex multi-server setup, run this as a separate release step instead
await runMigrations();

export default handler;
