import { type FC } from 'react';
import { ReactQueryProvider } from '../providers/react-query';
import { UserWords } from '../user-words';

export const UserWordsPage: FC = () => {
  return (
    <ReactQueryProvider>
      <UserWords />
    </ReactQueryProvider>
  );
};
