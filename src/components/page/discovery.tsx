import { type FC } from 'react';
import { ReactQueryProvider } from '../providers/react-query';
import { EditWordProvider } from '../providers/edit-word';
import { EditWordDialog } from '../edit-word-dialog';
import { Discovery } from '../discovery';

export const DiscoveryPage: FC = () => {
  return (
    <ReactQueryProvider>
      <EditWordProvider>
        <Discovery />
        <EditWordDialog />
      </EditWordProvider>
    </ReactQueryProvider>
  );
};
