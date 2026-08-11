import '@tanstack/react-start/server-only';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { GEMINI_API_KEY, OPENAI_API_KEY } from '../config';

export const google = createGoogleGenerativeAI({
  apiKey: GEMINI_API_KEY,
});

export const openai = createOpenAI({
  apiKey: OPENAI_API_KEY,
});
