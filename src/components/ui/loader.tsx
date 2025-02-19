import { cn } from '@/lib/utils';
import { LoaderCircle } from 'lucide-react';
import type { FC } from 'react';

type LoaderProps = {
  className?: string;
};

export const Loader: FC<LoaderProps> = ({ className }) => (
  <div className={cn('flex space-x-2', className)}>
    <LoaderCircle className="animate-spin" />
    <div>Loading...</div>
  </div>
);
