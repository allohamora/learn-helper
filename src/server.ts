import handler from '@tanstack/react-start/server-entry';
import { runMigrations } from '@/server/db/db.service';

// https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point#server-configuration
// migrations run as a separate release step in production
if (import.meta.env.DEV) {
  await runMigrations();
}

export default handler;
