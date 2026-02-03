import { type FC, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { UserWord } from '@/types/user-words.types';

type EditTranslationDialogProps = {
  editingWord: UserWord | null;
  isPending: boolean;
  onClose: () => void;
  onSave: (params: { wordId: number; userWordId: number; value: string }) => void;
};

export const EditTranslationDialog: FC<EditTranslationDialogProps> = ({ editingWord, isPending, onClose, onSave }) => {
  const [editValue, setEditValue] = useState(editingWord?.word.uaTranslation ?? '');

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed.length > 0 && editingWord) {
      onSave({ wordId: editingWord.word.id, userWordId: editingWord.id, value: trimmed });
    }
  };

  return (
    <Dialog
      open={editingWord !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit translation for &quot;{editingWord?.word.value}&quot;</DialogTitle>
        </DialogHeader>
        <input
          type="text"
          value={editValue}
          onChange={(event) => setEditValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleSave();
            }
          }}
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={isPending || editValue.trim().length === 0}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
