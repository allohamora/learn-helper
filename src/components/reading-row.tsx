import type { FC } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  title: string;
  totalPages: number;
  currentPage: number;
};

export const ReadingRow: FC<Props> = ({ title, totalPages, currentPage }) => {
  return (
    <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:gap-4">
      <div className="min-w-0 space-y-1.5">
        <h2 className="line-clamp-2 text-sm/5 font-medium text-balance sm:text-base">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {currentPage} / {totalPages}
        </p>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="size-8 shrink-0 justify-self-end px-0 sm:w-auto sm:px-2.5"
        disabled
        title="Read"
        aria-label="Read"
      >
        <BookOpen />
        <span className="hidden sm:inline">Read</span>
      </Button>
    </div>
  );
};
