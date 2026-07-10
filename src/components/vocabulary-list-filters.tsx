import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { getRouteApi } from '@tanstack/react-router';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEARNING_STATUS_LABEL, LEARNING_STATUS_ORDER, LearningStatus } from '@/const/vocabulary';

const routeApi = getRouteApi('/_auth/vocabulary_/$id');

const ALL_STATUSES = 'all';

export const VocabularyListFilters: FC = () => {
  const { status, search } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const [searchInput, setSearchInput] = useState(search ?? '');
  const [debouncedSearch] = useDebounce(searchInput, 300);

  useEffect(() => {
    navigate({ search: (prev) => ({ ...prev, search: debouncedSearch.trim() || undefined }) });
  }, [debouncedSearch, navigate]);

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
        onValueChange={(value) => {
          void navigate({
            search: (prev) => ({ ...prev, status: value === ALL_STATUSES ? undefined : (value as LearningStatus) }),
          });
        }}
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
