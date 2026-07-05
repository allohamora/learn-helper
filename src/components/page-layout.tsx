import { type FC, type PropsWithChildren } from 'react';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const PageLayout: FC<PropsWithChildren> = ({ children }) => {
  return (
    <>
      <Header />
      <main className="container mt-4 mb-4">{children}</main>
      <Footer />
    </>
  );
};
