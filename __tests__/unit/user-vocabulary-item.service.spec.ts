import { describe, it, expect } from 'vitest';
import { buildLearningBatch } from '@/server/user-vocabulary/user-vocabulary-item.service';

const items = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}-${i}`);

describe('user-vocabulary-item.service', () => {
  describe('buildLearningBatch', () => {
    it('interleaves [new, old, old, new, old, old] when both pools are plentiful', () => {
      const newPool = items('new', 6);
      const oldPool = items('old', 6);

      expect(buildLearningBatch(newPool, oldPool)).toEqual(['new-0', 'old-0', 'old-1', 'new-1', 'old-2', 'old-3']);
    });

    it('fills new slots from the old pool when the new pool is exhausted', () => {
      const newPool = items('new', 1);
      const oldPool = items('old', 6);

      expect(buildLearningBatch(newPool, oldPool)).toEqual(['new-0', 'old-0', 'old-1', 'old-2', 'old-3', 'old-4']);
    });

    it('fills old slots from the new pool when the old pool is exhausted', () => {
      const newPool = items('new', 6);
      const oldPool = items('old', 1);

      expect(buildLearningBatch(newPool, oldPool)).toEqual(['new-0', 'old-0', 'new-1', 'new-2', 'new-3', 'new-4']);
    });

    it('returns a shorter batch when both pools combined have fewer than 6 items', () => {
      const newPool = items('new', 1);
      const oldPool = items('old', 1);

      expect(buildLearningBatch(newPool, oldPool)).toEqual(['new-0', 'old-0']);
    });

    it('returns an empty batch when both pools are empty', () => {
      expect(buildLearningBatch([], [])).toEqual([]);
    });

    it('does not mutate the input pools', () => {
      const newPool = items('new', 6);
      const oldPool = items('old', 6);

      buildLearningBatch(newPool, oldPool);

      expect(newPool).toHaveLength(6);
      expect(oldPool).toHaveLength(6);
    });
  });
});
