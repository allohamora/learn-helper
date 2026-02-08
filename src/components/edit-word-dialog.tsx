import { type FC } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEditWord } from '@/components/providers/edit-word';

export const EditWordDialog: FC = () => {
  const { editingWord, editTranslation, setEditTranslation, closeEditWord, updateWord } = useEditWord();

  const handleSave = () => {
    const trimmed = editTranslation.trim();
    if (trimmed.length > 0 && editingWord) {
      updateWord.mutate({ wordId: editingWord.word.id, value: trimmed });
    }
  };

  return (
    <Dialog
      open={editingWord !== null}
      onOpenChange={(open) => {
        if (!open) closeEditWord();
      }}
    >
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            Edit translation for &quot;{editingWord?.word.value}&quot;
            {editingWord?.word.partOfSpeech ? ` (${editingWord.word.partOfSpeech})` : ''}
          </DialogTitle>
        </DialogHeader>
        <input
          type="text"
          value={editTranslation}
          onChange={(event) => setEditTranslation(event.target.value)}
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
          <Button onClick={handleSave} disabled={updateWord.isPending || editTranslation.trim().length === 0}>
            {updateWord.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
