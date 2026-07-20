import type { FC, UIEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import type { InferResponseType } from 'hono/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ExternalLink, Loader2, Pencil, Undo2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEditVocabularyItemTranslation } from '@/components/providers/edit-vocabulary-item-translation';
import { VocabularyStatusBadge } from '@/components/vocabulary-status-badge';
import { appClient } from '@/services/api';
import { LearningStatus } from '@/const/vocabulary';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { cn } from '@/lib/utils';

type ItemsResponse = InferResponseType<
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['items']['$get']
>;
type VocabularyItem = Extract<ItemsResponse, { success: true }>['data'][number];

export const requiresUndoConfirmation = (status: LearningStatus, encounterCount: number) =>
  encounterCount > 0 || status === LearningStatus.Learned;

const ActionsCell: FC<{ item: VocabularyItem; userVocabularyListId: string }> = ({ item, userVocabularyListId }) => {
  const [isUndoConfirmationOpen, setIsUndoConfirmationOpen] = useState(false);
  const { isPlaying, playAudio } = useAudioPlayer();
  const { openEdit } = useEditVocabularyItemTranslation();
  const { vocabularyItem } = item;
  const pronunciation = vocabularyItem.pronunciation;

  const queryClient = useQueryClient();
  const undoMutation = useMutation({
    mutationFn: async () => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].undo.$post({
        param: { userVocabularyListId, userVocabularyItemId: item.id },
      });
      if (!res.ok) throw new Error('Failed to undo discovery');

      return res.json();
    },
    onSuccess: () => {
      setIsUndoConfirmationOpen(false);
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-items'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-progress'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-learning-items'] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-learning-tasks'] });
      toast.success('Word progress reset to waiting in all lists');
    },
    onError: () => toast.error('Failed to reset word progress'),
  });

  const canUndo = item.status !== LearningStatus.Waiting;
  const needsConfirmation = requiresUndoConfirmation(item.status, item.encounterCount);
  const undo = () => {
    if (needsConfirmation) {
      setIsUndoConfirmationOpen(true);
      return;
    }

    undoMutation.mutate();
  };

  return (
    <div className="flex items-center gap-1">
      {pronunciation && (
        <Button
          size="sm"
          variant="ghost"
          className="size-8 px-0"
          disabled={isPlaying}
          onClick={() => void playAudio(pronunciation)}
          title="Play pronunciation"
          aria-label="Play pronunciation"
        >
          <Volume2 className={cn(isPlaying && 'animate-pulse')} />
        </Button>
      )}
      {vocabularyItem.link && (
        <Button
          size="sm"
          variant="ghost"
          className="size-8 px-0"
          asChild
          title="Open dictionary entry"
          aria-label="Open dictionary entry"
        >
          <a href={vocabularyItem.link} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
          </a>
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="size-8 px-0"
        onClick={() =>
          openEdit({
            userVocabularyItemId: item.id,
            value: vocabularyItem.value,
            partOfSpeech: vocabularyItem.partOfSpeech,
            uaTranslation: vocabularyItem.uaTranslation,
          })
        }
        title="Edit translation"
        aria-label="Edit translation"
      >
        <Pencil />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="size-8 px-0"
        disabled={!canUndo || undoMutation.isPending}
        onClick={undo}
        title="Reset word progress"
        aria-label="Reset word progress"
      >
        {undoMutation.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
      </Button>

      <Dialog
        open={isUndoConfirmationOpen}
        onOpenChange={(open) => !undoMutation.isPending && setIsUndoConfirmationOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset progress for “{vocabularyItem.value}”?</DialogTitle>
            <DialogDescription>
              This will erase {item.encounterCount} completed {item.encounterCount === 1 ? 'encounter' : 'encounters'}{' '}
              and return the word to Discovery. Because word progress is shared, this change applies to every list
              containing the word.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={undoMutation.isPending}
              onClick={() => setIsUndoConfirmationOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={undoMutation.isPending} onClick={() => undoMutation.mutate()}>
              {undoMutation.isPending && <Loader2 className="animate-spin" />}
              Reset progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const columnHelper = createColumnHelper<VocabularyItem>();

const buildColumns = (userVocabularyListId: string) => [
  columnHelper.accessor('vocabularyItem.value', {
    header: 'Word',
    cell: (info) => {
      const item = info.row.original;

      return (
        <div className="min-w-0">
          <div className="truncate font-medium">{item.vocabularyItem.value}</div>
          <div className="truncate text-xs text-muted-foreground">({item.vocabularyItem.spelling})</div>
          <div className="truncate text-xs text-muted-foreground">{item.vocabularyItem.uaTranslation}</div>
        </div>
      );
    },
  }),
  columnHelper.accessor('vocabularyItem.definition', {
    header: 'Definition',
    cell: (info) => <div className="text-muted-foreground">{info.getValue()}</div>,
  }),
  columnHelper.accessor('vocabularyItem.partOfSpeech', {
    header: 'Part of speech',
    cell: (info) => <div className="text-muted-foreground">{info.getValue() ?? '-'}</div>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <VocabularyStatusBadge status={info.getValue() as LearningStatus} />,
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => <ActionsCell item={row.original} userVocabularyListId={userVocabularyListId} />,
  }),
];

// one fixed template shared by the header and every row, so columns always line up (each row is
// its own grid instance — virtualization renders them independently — so tracks must be sized
// proportionally with a fixed-length floor, not to content, or a row's widths would depend on that
// row's own content instead of matching the header and other rows). Narrow viewports scroll the
// table horizontally (the container below is overflow-auto) rather than reflowing the columns.
const GRID_COLS_CLASS = 'grid grid-cols-[minmax(9rem,1.3fr)_minmax(10rem,3fr)_minmax(5rem,1fr)_7rem_minmax(7rem,1fr)]';

const ROW_HEIGHT_PX = 72;
const LOAD_MORE_THRESHOLD_PX = 200;

type Props = {
  items: VocabularyItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  userVocabularyListId: string;
};

export const VocabularyItemsTable: FC<Props> = ({
  items,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  userVocabularyListId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const columns = useMemo(() => buildColumns(userVocabularyListId), [userVocabularyListId]);

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (item) => item.id,
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
