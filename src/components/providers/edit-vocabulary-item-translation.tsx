import type { FC, PropsWithChildren } from 'react';
import { createContext, use, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appClient } from '@/services/api';

type EditableVocabularyItem = {
  userVocabularyItemId: string;
  value: string;
  partOfSpeech: string | null;
  uaTranslation: string;
};

type EditVocabularyItemTranslationContextValue = {
  editingItem: EditableVocabularyItem | null;
  openEdit: (item: EditableVocabularyItem) => void;
  closeEdit: () => void;
  saveTranslation: (uaTranslation: string) => void;
  isSaving: boolean;
};

const EditVocabularyItemTranslationContext = createContext<EditVocabularyItemTranslationContextValue | null>(null);

type Props = PropsWithChildren<{ userVocabularyListId: string }>;

export const EditVocabularyItemTranslationProvider: FC<Props> = ({ userVocabularyListId, children }) => {
  const [editingItem, setEditingItem] = useState<EditableVocabularyItem | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      userVocabularyItemId,
      uaTranslation,
    }: {
      userVocabularyItemId: string;
      uaTranslation: string;
    }) => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].translation.$patch({
        param: { userVocabularyListId, userVocabularyItemId },
        json: { uaTranslation },
      });
      if (!res.ok) throw new Error('Failed to update translation');

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-items', userVocabularyListId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-discovery-items', userVocabularyListId] });
      queryClient.invalidateQueries({ queryKey: ['vocabulary-list-learning-items', userVocabularyListId] });
      setEditingItem(null);
      toast.success('Translation updated');
    },
    onError: () => toast.error('Failed to update translation'),
  });

  const saveTranslation = (uaTranslation: string) => {
    if (!editingItem) return;

    mutation.mutate({ userVocabularyItemId: editingItem.userVocabularyItemId, uaTranslation });
  };

  return (
    <EditVocabularyItemTranslationContext
      value={{
        editingItem,
        openEdit: setEditingItem,
        closeEdit: () => setEditingItem(null),
        saveTranslation,
        isSaving: mutation.isPending,
      }}
    >
      {children}
    </EditVocabularyItemTranslationContext>
  );
};

export const useEditVocabularyItemTranslation = () => {
  const context = use(EditVocabularyItemTranslationContext);
  if (!context) {
    throw new Error('useEditVocabularyItemTranslation must be used within an EditVocabularyItemTranslationProvider');
  }

  return context;
};
