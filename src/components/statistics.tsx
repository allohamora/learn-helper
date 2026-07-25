import type { FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatisticsDashboard } from '@/components/statistics-dashboard';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { useMediaQuery } from '@/hooks/use-media-query';
import { appClient } from '@/services/api';
import { getBrowserTimezone } from '@/utils/date';

const PHONE_MEDIA_QUERY = '(max-width: 640px)';

export const Statistics: FC = () => {
  const timezone = getBrowserTimezone();
  const isPhoneScreen = useMediaQuery(PHONE_MEDIA_QUERY);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['statistics', timezone],
    queryFn: async () => {
      const response = await appClient.api.v1.users.me.statistics.$get({ query: { timezone } });
      if (!response.ok) throw new Error('Failed to load statistics');

      return (await response.json()).data;
    },
  });

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="mb-4 text-destructive">{error.message}</p>
          <Button onClick={() => void refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader />
      </div>
    );
  }

  return <StatisticsDashboard data={data} isPhoneScreen={isPhoneScreen} />;
};
