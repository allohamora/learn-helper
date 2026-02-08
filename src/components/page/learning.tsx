import { type FC } from 'react';
import { ReactQueryProvider } from '../providers/react-query';
import { EditWordProvider } from '../providers/edit-word';
import { EditWordDialog } from '../edit-word-dialog';
import { Learning } from '../learning';

export const LearningPage: FC = () => {
  return (
    <ReactQueryProvider>
      <EditWordProvider>
        <Learning />
        <EditWordDialog />
      </EditWordProvider>
    </ReactQueryProvider>
  );
};
