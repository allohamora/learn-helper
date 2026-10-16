import type { FC } from 'react';
import { ClientOnly, getRouteApi } from '@tanstack/react-router';
import { PdfReader } from '../components/pdf-reader';

const route = getRouteApi('/_auth/readings_/$readingId');

export const ReadingPage: FC = () => {
  const reading = route.useLoaderData();

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
