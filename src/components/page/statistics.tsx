import { type FC } from 'react';
import { ReactQueryProvider } from '../providers/react-query';
import { Statistics } from '../statistics';

export const StatisticsPage: FC = () => {
  return (
    <ReactQueryProvider>
      <Statistics />
    </ReactQueryProvider>
  );
};
