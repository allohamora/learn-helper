import { app } from '@/server/api';
import { fromWebHandler } from 'nitro/h3';

export default fromWebHandler(async (request) => app.fetch(request));
