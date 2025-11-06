import { type FC, useMemo, useRef } from 'react';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { Status, type UserWord } from '@/types/user-words.types';

type WordsTableProps = {
  data: UserWord[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  showPartOfSpeech?: boolean;
};

export const WordsTable: FC<WordsTableProps> = ({
  data,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  showPartOfSpeech = true,
}) => {
  const { isPlaying, playAudio } = useAudioPlayer();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<UserWord>[]>(() => {
    const baseColumns: ColumnDef<UserWord>[] = [
      {
        accessorKey: 'word.value',
        header: 'Word',
        cell: ({ row }) => {
          const { word } = row.original;
          return (
            <div className="min-w-[120px]">
              <div className="font-medium">
                {word.value}
                {word.spelling && word.spelling !== word.value && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">({word.spelling})</span>
                )}

                <div className="mt-1 text-xs font-medium text-muted-foreground">{word.uaTranslation}</div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'word.definition',
        header: 'Definition',
        cell: ({ getValue }) => <div className="min-w-[200px] text-sm text-muted-foreground">{getValue<string>()}</div>,
      },
      {
        accessorKey: 'word.level',
        header: 'Level',
        cell: ({ getValue }) => (
          <Badge variant="outline" className="px-2 py-0.5 text-xs">
            {getValue<string>()}
          </Badge>
        ),
      },
    ];

    if (showPartOfSpeech) {
      baseColumns.push({
        accessorKey: 'word.partOfSpeech',
        header: 'Part of Speech',
        cell: ({ row }) => {
          const { word } = row.original;
          const partOfSpeech = word.partOfSpeech;
          return partOfSpeech ? (
            <Badge variant="outline" className="px-2 py-0.5 text-xs">
              {partOfSpeech}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
      });
    }

    baseColumns.push(
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => (
          <Badge
            variant={getValue<string>() === Status.Learning ? 'default' : 'secondary'}
            className="px-2 py-0.5 text-xs"
          >
            {getValue<string>()}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const { word } = row.original;
          return (
            <div className="flex items-center gap-1">
              {word.pronunciation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    playAudio(word.pronunciation);
                  }}
                  disabled={isPlaying}
                  className="h-6 w-6 shrink-0 p-0"
                  title="Play pronunciation"
                >
                  <Volume2 className={cn('h-3 w-3', { 'animate-pulse': isPlaying })} />
                </Button>
              )}
              {word.link && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-6 w-6 shrink-0 p-0"
                  title="View in Oxford Dictionary"
                >
                  <a href={word.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>
          );
        },
      },
    );

    return baseColumns;
  }, [isPlaying, playAudio, showPartOfSpeech]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const handleScroll = () => {
    if (!tableContainerRef.current || !hasNextPage || isFetchingNextPage) return;

    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom < 200) {
      onLoadMore?.();
    }
  };

  const getColumnFlex = (columnId: string) => {
    switch (columnId) {
      case 'word_value':
        return '0 0 200px';
      case 'word_definition':
        return '1 0 400px';
      case 'word_level':
        return '0 0 100px';
      case 'word_partOfSpeech':
        return '0 0 150px';
      case 'status':
        return '0 0 100px';
      case 'actions':
        return '0 0 120px';
      default:
        return '0 0 100px';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading words...</div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg">
      <div ref={tableContainerRef} className="overflow-auto" style={{ height: '600px' }} onScroll={handleScroll}>
        <div className="sticky top-0 z-10 w-full min-w-fit bg-background">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="flex min-w-fit border-b border-border">
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  className="flex shrink-0 items-center p-4 text-left text-xs font-medium tracking-wider text-muted-foreground uppercase"
                  style={{ flex: getColumnFlex(header.id) }}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="w-full min-w-fit">
          <div style={{ height: totalSize, position: 'relative' }}>
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row?.id}
                  className="flex w-full min-w-fit items-center pt-2 hover:bg-muted/50"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                >
                  {row?.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="flex shrink-0 items-center px-4 py-2"
                      style={{ flex: getColumnFlex(cell.column.id) }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}

            {isFetchingNextPage && (
              <div className="flex items-center justify-center p-4">
                <div className="text-sm text-muted-foreground">Loading more words...</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!hasNextPage && data.length > 0 && (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-muted-foreground">You&apos;ve reached the end! No more words to show.</div>
        </div>
      )}

      {data.length === 0 && !isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">
            No words found. Try adjusting your filters or add some words to get started.
          </div>
        </div>
      )}
    </div>
  );
};
