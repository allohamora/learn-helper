import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PronunciationToVocabularyItem } from '@/components/pronunciation-to-vocabulary-item';
import { UserVocabularyItemTaskType } from '@/const/event';
import type { PronunciationToVocabularyItemTask } from '@/types/learn';

describe('PronunciationToVocabularyItem', () => {
  const renderTask = (pronunciation: string | null) => {
    const data: PronunciationToVocabularyItemTask['data'] = {
      id: crypto.randomUUID(),
      vocabularyItem: 'achieve',
      pronunciation,
      spelling: '/əˈtʃiːv/',
    };

    return render(
      <PronunciationToVocabularyItem
        data={data}
        userVocabularyListId={crypto.randomUUID()}
        taskType={UserVocabularyItemTaskType.PronunciationToVocabularyItem}
        onMistake={vi.fn()}
        onNext={vi.fn()}
      />,
    );
  };

  afterEach(() => {
    cleanup();
  });

  it('renders the audio prompt and keeps spelling behind a reveal when pronunciation exists', () => {
    renderTask('https://example.com/achieve.mp3');

    expect(screen.getByText('Which item matches this pronunciation?')).toBeTruthy();
    expect(screen.getByTitle('Play pronunciation')).toBeTruthy();
    expect(screen.getByText('Show spelling')).toBeTruthy();
  });

  it('renders spelling as the prompt when pronunciation is absent', () => {
    renderTask(null);

    expect(screen.getByText('Which item matches this spelling?')).toBeTruthy();
    expect(screen.getByText('/əˈtʃiːv/')).toBeTruthy();
    expect(screen.queryByTitle('Play pronunciation')).toBeNull();
    expect(screen.queryByText('Show spelling')).toBeNull();
  });
});
