import type { FC, KeyboardEvent } from 'react';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useEditVocabularyItemTranslation } from '@/components/providers/edit-vocabulary-item-translation';

type EditFormProps = {
  value: string;
  partOfSpeech: string | null;
  initialUaTranslation: string;
  closeEdit: () => void;
  saveTranslation: (uaTranslation: string) => void;
  isSaving: boolean;
};

const EditForm: FC<EditFormProps> = ({
  value,
  partOfSpeech,
  initialUaTranslation,
  closeEdit,
  saveTranslation,
  isSaving,
}) => {
  const [uaTranslation, setUaTranslation] = useState(initialUaTranslation);

  const trimmed = uaTranslation.trim();
  const canSave = trimmed.length > 0 && !isSaving;

  const handleSave = () => {
    if (!canSave) return;

    saveTranslation(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleSave();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Edit translation - {value}
          {partOfSpeech && <span className="text-muted-foreground"> ({partOfSpeech.replace(/-/g, ' ')})</span>}
        </DialogTitle>
      </DialogHeader>

      <Input
        value={uaTranslation}
        onChange={(event) => setUaTranslation(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        autoFocus
      />

      <DialogFooter>
        <Button variant="outline" onClick={closeEdit} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {isSaving && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
};

export const EditVocabularyItemTranslationDialog: FC = () => {
  const { editingItem, closeEdit, saveTranslation, isSaving } = useEditVocabularyItemTranslation();

  return (
    <Dialog open={editingItem !== null} onOpenChange={(open) => !open && closeEdit()}>
      <DialogContent>
        {editingItem && (
          <EditForm
            key={editingItem.userVocabularyItemId}
            value={editingItem.value}
            partOfSpeech={editingItem.partOfSpeech}
            initialUaTranslation={editingItem.uaTranslation}
            closeEdit={closeEdit}
            saveTranslation={saveTranslation}
            isSaving={isSaving}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
