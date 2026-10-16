import type { FC } from 'react';
import { ClientOnly } from '@tanstack/react-router';
import { PdfReader } from '../components/pdf-reader';

type Props = {
  reading: {
    id: string;
    totalPages: number;
    currentPage: number;
  };
};

export const ReadingPage: FC<Props> = ({ reading }) => {
  return (
    <ClientOnly>
      <PdfReader
        key={reading.id}
        readingId={reading.id}
        totalPages={reading.totalPages}
        initialPage={reading.currentPage}
      />
    </ClientOnly>
  );
};
