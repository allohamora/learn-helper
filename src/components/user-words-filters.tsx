import { type FC } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Level, type List, type Status } from '@/types/user-words.types';

type UserWordsFiltersProps = {
  level?: Level;
  status?: Status;
  onLevelChange: (level?: Level) => void;
  onStatusChange: (status?: Status) => void;
};

const LEVELS: { value: Level; label: string }[] = [
  { value: 'a1', label: 'A1 - Beginner' },
  { value: 'a2', label: 'A2 - Elementary' },
  { value: 'b1', label: 'B1 - Intermediate' },
  { value: 'b2', label: 'B2 - Upper Intermediate' },
  { value: 'c1', label: 'C1 - Advanced' },
];

const STATUSES: { value: 'waiting' | 'learning' | 'known' | 'learned'; label: string }[] = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'learning', label: 'Learning' },
  { value: 'known', label: 'Known' },
  { value: 'learned', label: 'Learned' },
];

const LIST_TYPES: { value: List; label: string }[] = [
  { value: 'oxford-5000-words', label: 'Oxford 5000 Words' },
  { value: 'oxford-phrase-list', label: 'Oxford Phrase List' },
];

export const UserWordsFilters: FC<UserWordsFiltersProps> = ({ level, status, onLevelChange, onStatusChange }) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex items-center gap-2">
        <label htmlFor="level-filter" className="text-sm font-medium">
          Level:
        </label>
        <Select
          value={level || 'all'}
          onValueChange={(value) => onLevelChange(value === 'all' ? undefined : (value as Level))}
        >
          <SelectTrigger id="level-filter" className="w-[200px]">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {LEVELS.map((levelOption) => (
              <SelectItem key={levelOption.value} value={levelOption.value}>
                {levelOption.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium">
          Status:
        </label>
        <Select
          value={status || 'all'}
          onValueChange={(value) => onStatusChange(value === 'all' ? undefined : (value as Status))}
        >
          <SelectTrigger id="status-filter" className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((statusOption) => (
              <SelectItem key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
