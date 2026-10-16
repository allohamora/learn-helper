import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEARNING_STATUS_LABEL, LEARNING_STATUS_ORDER, LearningStatus } from '@/const/vocabulary';

const ALL_STATUSES = 'all';

type VocabularyListFiltersProps = {
  status?: LearningStatus;
  search?: string;
  onChange: (patch: { status?: LearningStatus; search?: string }) => void;
};

export const VocabularyListFilters: FC<VocabularyListFiltersProps> = ({ status, search, onChange }) => {
  const [searchInput, setSearchInput] = useState(search ?? '');
  const [debouncedSearch] = useDebounce(searchInput, 300);

  useEffect(() => {
    onChange({ search: debouncedSearch.trim() || undefined });
  }, [debouncedSearch, onChange]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        placeholder="Search items..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="sm:max-w-64"
      />

      <Select
        value={status ?? ALL_STATUSES}
        onValueChange={(value) => onChange({ status: LEARNING_STATUS_ORDER.find((option) => option === value) })}
      >
        <SelectTrigger className="sm:w-40">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
          {LEARNING_STATUS_ORDER.map((option) => (
            <SelectItem key={option} value={option}>
              {LEARNING_STATUS_LABEL[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
