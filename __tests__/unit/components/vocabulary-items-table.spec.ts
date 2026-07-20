import { describe, expect, it } from 'vitest';
import { requiresUndoConfirmation } from '@/components/vocabulary-items-table';
import { LearningStatus } from '@/const/vocabulary';

describe('requiresUndoConfirmation', () => {
  it('requires confirmation when learning progress would be erased', () => {
    expect(requiresUndoConfirmation(LearningStatus.Learning, 1)).toBe(true);
    expect(requiresUndoConfirmation(LearningStatus.Learned, 3)).toBe(true);
  });

  it('does not require confirmation when no encounters have been completed', () => {
    expect(requiresUndoConfirmation(LearningStatus.Learning, 0)).toBe(false);
    expect(requiresUndoConfirmation(LearningStatus.Known, 0)).toBe(false);
  });
});
