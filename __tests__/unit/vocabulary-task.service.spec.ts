import { describe, it, expect } from 'vitest';
import { tasksMatchRequestedItems, type VocabularyItemData } from '@/server/user-vocabulary/vocabulary-task.service';

const item = (id: string): VocabularyItemData => ({ id, value: id, partOfSpeech: null });
const task = (id: string) => ({ id, sentence: `sentence-${id}`, translation: `translation-${id}` });

describe('vocabulary-task.service', () => {
  describe('tasksMatchRequestedItems', () => {
    it('returns true when tasks are a one-to-one match with the requested items', () => {
      const items = [item('a'), item('b'), item('c')];
      const tasks = [task('a'), task('b'), task('c')];

      expect(tasksMatchRequestedItems(tasks, items)).toBe(true);
    });

    it('returns true regardless of order', () => {
      const items = [item('a'), item('b'), item('c')];
      const tasks = [task('c'), task('a'), task('b')];

      expect(tasksMatchRequestedItems(tasks, items)).toBe(true);
    });

    it('returns false when a task is missing for a requested item', () => {
      const items = [item('a'), item('b'), item('c')];
      const tasks = [task('a'), task('b')];

      expect(tasksMatchRequestedItems(tasks, items)).toBe(false);
    });

    it('returns false when the same id is used for two tasks', () => {
      const items = [item('a'), item('b'), item('c')];
      const tasks = [task('a'), task('a'), task('b')];

      expect(tasksMatchRequestedItems(tasks, items)).toBe(false);
    });

    it('returns false when a task has a fabricated id not in the requested items', () => {
      const items = [item('a'), item('b'), item('c')];
      const tasks = [task('a'), task('b'), task('unknown')];

      expect(tasksMatchRequestedItems(tasks, items)).toBe(false);
    });

    it('returns false when there are more tasks than requested items', () => {
      const items = [item('a'), item('b')];
      const tasks = [task('a'), task('b'), task('c')];

      expect(tasksMatchRequestedItems(tasks, items)).toBe(false);
    });

    it('returns true for an empty batch', () => {
      expect(tasksMatchRequestedItems([], [])).toBe(true);
    });
  });
});
