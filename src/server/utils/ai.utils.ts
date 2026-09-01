import '@tanstack/react-start/server-only';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelUsage } from 'ai';
import { OPENAI_API_KEY } from '../config';

export const openai = createOpenAI({
  apiKey: OPENAI_API_KEY,
});

export const model = openai('gpt-5.6-luna');

// gpt-5.6-luna standard-tier, short-context pricing: https://developers.openai.com/api/docs/pricing
const INPUT_NANO_DOLLARS_PER_TOKEN = 200;
const OUTPUT_NANO_DOLLARS_PER_TOKEN = 1200;

export const calculateCostInNanoDollars = ({ inputTokens = 0, outputTokens = 0 }: LanguageModelUsage) => {
  const inputCostInNanoDollars = inputTokens * INPUT_NANO_DOLLARS_PER_TOKEN;
  const outputCostInNanoDollars = outputTokens * OUTPUT_NANO_DOLLARS_PER_TOKEN;

  return inputCostInNanoDollars + outputCostInNanoDollars;
};
