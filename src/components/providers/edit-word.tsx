import { createContext, useContext, useState, type FC, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { useToast } from '@/hooks/use-toast';
import type { UserWord } from '@/types/user-words.types';

type UpdateWordMutation = ReturnType<typeof useUpdateWordMutation>;

type EditWordContextValue = {
  editingWord: UserWord | null;
  editTranslation: string;
  setEditTranslation: (value: string) => void;
  openEditWord: (word: UserWord) => void;
  closeEditWord: () => void;
  updateWord: UpdateWordMutation;
};

const EditWordContext = createContext<EditWordContextValue | null>(null);

const useUpdateWordMutation = (onSuccess: () => void) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wordId, value }: { wordId: number; value: string }) => {
      return await actions.updateWord.orThrow({ wordId, uaTranslation: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getUserWords'] });
      queryClient.invalidateQueries({ queryKey: ['getWaitingWords'] });
      queryClient.invalidateQueries({ queryKey: ['getLearningWords'] });
      onSuccess();
      toast({ title: 'Success', description: 'Translation updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update translation', variant: 'destructive' });
    },
  });
};

type EditWordProviderProps = {
  children: ReactNode;
};

export const EditWordProvider: FC<EditWordProviderProps> = ({ children }) => {
  const [editingWord, setEditingWord] = useState<UserWord | null>(null);
  const [editTranslation, setEditTranslation] = useState('');

  const closeEditWord = () => setEditingWord(null);
  const openEditWord = (word: UserWord) => {
    setEditingWord(word);
    setEditTranslation(word.word.uaTranslation);
  };

  const updateWord = useUpdateWordMutation(closeEditWord);

  return (
    <EditWordContext.Provider
      value={{ editingWord, editTranslation, setEditTranslation, openEditWord, closeEditWord, updateWord }}
    >
      {children}
    </EditWordContext.Provider>
  );
};

export const useEditWord = (): EditWordContextValue => {
  const context = useContext(EditWordContext);

  if (!context) {
    throw new Error('useEditWord must be used within an EditWordProvider');
  }

  return context;
};
