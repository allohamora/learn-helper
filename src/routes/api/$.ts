import { createFileRoute } from '@tanstack/react-router';
import { app } from '@/server/api';
import { runMigrations } from '@/server/db/db.service';

await runMigrations();

const serve = ({ request }: { request: Request }) => {
  return app.fetch(request);
};

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      DELETE: serve,
      GET: serve,
      HEAD: serve,
      OPTIONS: serve,
      PATCH: serve,
      POST: serve,
      PUT: serve,
    },
  },
});
