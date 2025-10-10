import { type FC } from 'react';
import { ReactQueryProvider } from '../providers/react-query';
import { Learning } from '../learning';

export const LearningPage: FC = () => {
  return (
    <ReactQueryProvider>
      <Learning />
    </ReactQueryProvider>
  );
};
