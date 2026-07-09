import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/statistics')({ component: StatisticsPage });

function StatisticsPage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 pt-4 text-center md:pt-8">
      <h1 className="text-2xl font-bold tracking-tight md:text-4xl">Statistics</h1>
    </div>
  );
}
