import type { FC } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2, Trash2 } from 'lucide-react';
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
import { appClient } from '@/services/api';

type Props = {
  id: string;
  title: string;
  totalPages: number;
  currentPage: number;
};

export const ReadingRow: FC<Props> = ({ id, title, totalPages, currentPage }) => {
  const [isRemoveConfirmationOpen, setIsRemoveConfirmationOpen] = useState(false);
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await appClient.api.v1.users.me.readings[':readingId'].$delete({ param: { readingId: id } });
      if (!res.ok) throw new Error('Failed to delete reading');

      return res.json();
    },
    onSuccess: () => {
      setIsRemoveConfirmationOpen(false);
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      toast.success('Reading deleted');
    },
    onError: () => toast.error('Failed to delete reading'),
  });

  return (
    <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:gap-4">
      <div className="min-w-0 space-y-1.5">
        <h2 className="line-clamp-2 text-sm/5 font-medium text-balance sm:text-base">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {currentPage} / {totalPages}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 justify-self-end">
        <Button
          size="sm"
          variant="outline"
          className="size-8 shrink-0 px-0 sm:w-auto sm:px-2.5"
          disabled
          title="Read"
          aria-label="Read"
        >
          <BookOpen />
          <span className="hidden sm:inline">Read</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="size-8 px-0"
          disabled={removeMutation.isPending}
          onClick={() => setIsRemoveConfirmationOpen(true)}
          title="Delete reading"
          aria-label="Delete reading"
        >
          {removeMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      </div>

      <Dialog open={isRemoveConfirmationOpen} onOpenChange={setIsRemoveConfirmationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{title}&rdquo;?</DialogTitle>
            <DialogDescription>
              This permanently deletes the reading, its file, and all related events, including its upload history. Use
              this only if you uploaded the wrong file — this action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemoveConfirmationOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
              {removeMutation.isPending && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
