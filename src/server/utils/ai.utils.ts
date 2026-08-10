import '@tanstack/react-start/server-only';
import { createOpenAI } from '@ai-sdk/openai';
import { OPENAI_API_KEY } from '../config';

export const openai = createOpenAI({
  apiKey: OPENAI_API_KEY,
});
