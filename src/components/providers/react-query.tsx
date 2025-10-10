import { type FC, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type ReactQueryProviderProps = {
  children: ReactNode;
};

export const ReactQueryProvider: FC<ReactQueryProviderProps> = ({ children }) => {
  const queryClient = new QueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
