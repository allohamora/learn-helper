import '@tanstack/react-start/client-only';
import { hc } from 'hono/client';
import type { AppType } from '@/server/api';

export const appClient = hc<AppType>('');
