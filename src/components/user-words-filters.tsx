import { type FC } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Level, Status } from '@/types/user-words.types';

type UserWordsFiltersProps = {
  level?: Level;
  status?: Status;
  onLevelChange: (level?: Level) => void;
  onStatusChange: (status?: Status) => void;
};

const LEVELS: { value: Level; label: string }[] = [
  { value: Level.A1, label: 'A1 - Beginner' },
  { value: Level.A2, label: 'A2 - Elementary' },
  { value: Level.B1, label: 'B1 - Intermediate' },
  { value: Level.B2, label: 'B2 - Upper Intermediate' },
  { value: Level.C1, label: 'C1 - Advanced' },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: Status.Waiting, label: 'Waiting' },
  { value: Status.Learning, label: 'Learning' },
  { value: Status.Struggling, label: 'Struggling' },
  { value: Status.Reviewing, label: 'Reviewing' },
  { value: Status.Learned, label: 'Learned' },
  { value: Status.Known, label: 'Known' },
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
