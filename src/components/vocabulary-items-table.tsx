import type { FC, UIEvent } from 'react';
import { useRef } from 'react';
import type { InferResponseType } from 'hono/client';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ExternalLink, RotateCcw, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VocabularyStatusBadge } from '@/components/vocabulary-status-badge';
import { appClient } from '@/services/api';
import { LearningStatus } from '@/const/vocabulary';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { cn } from '@/lib/utils';

type ItemsResponse = InferResponseType<
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['items']['$get']
>;
type VocabularyItem = Extract<ItemsResponse, { success: true }>['data'][number];

const ActionsCell: FC<{ item: VocabularyItem }> = ({ item }) => {
  const { isPlaying, playAudio } = useAudioPlayer();

  return (
    <div className="flex items-center gap-1">
      {item.pronunciation && (
        <Button
          size="sm"
          variant="ghost"
          className="size-8 px-0"
          disabled={isPlaying}
          onClick={() => void playAudio(item.pronunciation!)}
          title="Play pronunciation"
          aria-label="Play pronunciation"
        >
          <Volume2 className={cn(isPlaying && 'animate-pulse')} />
        </Button>
      )}
      {item.link && (
        <Button
          size="sm"
          variant="ghost"
          className="size-8 px-0"
          asChild
          title="Open dictionary entry"
          aria-label="Open dictionary entry"
        >
          <a href={item.link} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
          </a>
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="size-8 px-0"
        disabled
        title="Reset to waiting (coming soon)"
        aria-label="Reset to waiting"
      >
        <RotateCcw />
      </Button>
    </div>
  );
};

const columnHelper = createColumnHelper<VocabularyItem>();

const columns = [
  columnHelper.accessor('value', {
    header: 'Word',
    cell: (info) => <div className="truncate font-medium">{info.getValue()}</div>,
  }),
  columnHelper.accessor('definition', {
    header: 'Definition',
    cell: (info) => <div className="text-muted-foreground">{info.getValue()}</div>,
  }),
  columnHelper.accessor('partOfSpeech', {
    header: 'Part of speech',
    cell: (info) => <div className="text-muted-foreground">{info.getValue() ?? '—'}</div>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <VocabularyStatusBadge status={info.getValue() as LearningStatus} />,
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => <ActionsCell item={row.original} />,
  }),
];

// one fixed template shared by the header and every row, so columns always line up (each row is
// its own grid instance — virtualization renders them independently — so tracks must be sized
// proportionally with a fixed-length floor, not to content, or a row's widths would depend on that
// row's own content instead of matching the header and other rows). Narrow viewports scroll the
// table horizontally (the container below is overflow-auto) rather than reflowing the columns.
const GRID_COLS_CLASS =
  'grid grid-cols-[minmax(6rem,1fr)_minmax(10rem,3fr)_minmax(5rem,1fr)_minmax(6rem,1fr)_minmax(7rem,1fr)]';

const ROW_HEIGHT_PX = 56;
const LOAD_MORE_THRESHOLD_PX = 200;

type Props = {
  items: VocabularyItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
};

export const VocabularyItemsTable: FC<Props> = ({ items, hasNextPage, isFetchingNextPage, onLoadMore }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (item) => item.userVocabularyItemId,
  });

  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
  });

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasNextPage || isFetchingNextPage) return;

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom < LOAD_MORE_THRESHOLD_PX) {
      onLoadMore();
    }
  };

  if (rows.length === 0) {
    return <p className="h-24 py-8 text-center text-sm text-muted-foreground">No items match your filters.</p>;
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="h-[600px] overflow-auto">
      <div className={cn(GRID_COLS_CLASS, 'sticky top-0 z-10 border-b bg-background')}>
        {table.getHeaderGroups()[0]?.headers.map((header) => (
          <div key={header.id} className="min-w-0 truncate px-3 py-2.5 text-left text-sm font-medium text-foreground">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        ))}
      </div>

      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;

          return (
            <div
              key={row.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className={cn(GRID_COLS_CLASS, 'absolute top-0 left-0 w-full items-center border-b hover:bg-muted/40')}
              style={{ minHeight: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
            >
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} className="min-w-0 px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
