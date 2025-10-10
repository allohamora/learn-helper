import { type FC } from 'react';
import { ReactQueryProvider } from '../providers/react-query';
import { LearningOrchestrator } from '../learning-orchestrator';

export const LearningPage: FC = () => {
  return (
    <ReactQueryProvider>
      <LearningOrchestrator />
    </ReactQueryProvider>
  );
};
