import { hc } from 'hono/client';
import type { AppType } from '@/server/api';

export const appClient = hc<AppType>('');
