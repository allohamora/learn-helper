import { type FC } from 'react';
import { ReactQueryProvider } from '../providers/react-query';
import { EditWordProvider } from '../providers/edit-word';
import { EditWordDialog } from '../edit-word-dialog';
import { UserWords } from '../user-words';

export const UserWordsPage: FC = () => {
  return (
    <ReactQueryProvider>
      <EditWordProvider>
        <UserWords />
        <EditWordDialog />
      </EditWordProvider>
    </ReactQueryProvider>
  );
};
