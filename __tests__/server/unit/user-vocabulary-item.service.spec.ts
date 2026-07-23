import { describe, it, expect } from 'vitest';
import { buildLearnBatch } from '@/server/user-vocabulary/user-vocabulary-item.service';

const items = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, itemIndex) => `${prefix}-${itemIndex}`);

describe('user-vocabulary-item.service', () => {
  describe('buildLearnBatch', () => {
    it('interleaves [new, review, review, new, review, review] when both pools are plentiful', () => {
      const newPool = items('new', 6);
      const reviewPool = items('review', 6);

      expect(buildLearnBatch(newPool, reviewPool)).toEqual([
        'new-0',
        'review-0',
        'review-1',
        'new-1',
        'review-2',
        'review-3',
      ]);
    });

    it('fills new slots from the review pool when the new pool is exhausted', () => {
      const newPool = items('new', 1);
      const reviewPool = items('review', 6);

      expect(buildLearnBatch(newPool, reviewPool)).toEqual([
        'new-0',
        'review-0',
        'review-1',
        'review-2',
        'review-3',
        'review-4',
      ]);
    });

    it('fills review slots from the new pool when the review pool is exhausted', () => {
      const newPool = items('new', 6);
      const reviewPool = items('review', 1);

      expect(buildLearnBatch(newPool, reviewPool)).toEqual(['new-0', 'review-0', 'new-1', 'new-2', 'new-3', 'new-4']);
    });

    it('returns a shorter batch when both pools combined have fewer than 6 items', () => {
      const newPool = items('new', 1);
      const reviewPool = items('review', 1);

      expect(buildLearnBatch(newPool, reviewPool)).toEqual(['new-0', 'review-0']);
    });

    it('returns an empty batch when both pools are empty', () => {
      expect(buildLearnBatch([], [])).toEqual([]);
    });

    it('does not mutate the input pools', () => {
      const newPool = items('new', 6);
      const reviewPool = items('review', 6);
      const originalNewPool = [...newPool];
      const originalReviewPool = [...reviewPool];

      buildLearnBatch(newPool, reviewPool);

      expect(newPool).toEqual(originalNewPool);
      expect(reviewPool).toEqual(originalReviewPool);
    });
  });
});
