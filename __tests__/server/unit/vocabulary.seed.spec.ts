import { describe, expect, it } from 'vitest';
import { groupRowsByLevel } from '@/server/vocabulary/vocabulary.seed';

describe('vocabulary.seed', () => {
  describe('groupRowsByLevel', () => {
    it('groups rows by level, preserving row order within each group', () => {
      const rows = [
        { level: 'a1', value: 'a' },
        { level: 'b1', value: 'b' },
        { level: 'a1', value: 'c' },
      ];

      const rowsByLevel = groupRowsByLevel(rows);

      expect([...rowsByLevel.keys()]).toEqual(['a1', 'b1']);
      expect(rowsByLevel.get('a1')).toEqual([rows[0], rows[2]]);
      expect(rowsByLevel.get('b1')).toEqual([rows[1]]);
    });

    it('returns an empty map for an empty array', () => {
      expect(groupRowsByLevel([])).toEqual(new Map());
    });
  });
});
