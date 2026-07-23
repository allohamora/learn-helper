import type { FC } from 'react';
import { cn } from '@/lib/utils';
import { LoaderCircle } from 'lucide-react';

type LoaderProps = {
  className?: string;
};

export const Loader: FC<LoaderProps> = ({ className }) => (
  <div className={cn('flex space-x-2', className)} role="status" aria-live="polite">
    <LoaderCircle className="animate-spin" aria-hidden="true" />
    <div>Loading...</div>
  </div>
);
