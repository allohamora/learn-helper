import { type FC } from 'react';
import { ReactQueryProvider } from '../providers/react-query';
import { Discovery } from '../discovery';

export const DiscoveryPage: FC = () => {
  return (
    <ReactQueryProvider>
      <Discovery />
    </ReactQueryProvider>
  );
};
