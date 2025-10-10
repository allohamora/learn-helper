import { type FC, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type UserWordsProviderProps = {
  children: ReactNode;
};

export const ReactQueryProvider: FC<UserWordsProviderProps> = ({ children }) => {
  const queryClient = new QueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
