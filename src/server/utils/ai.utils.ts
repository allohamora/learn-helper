import '@tanstack/react-start/server-only';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel, LanguageModelUsage } from 'ai';
import { GEMINI_API_KEY, OPENAI_API_KEY } from '../config';

const google = createGoogleGenerativeAI({
  apiKey: GEMINI_API_KEY,
});

const openai = createOpenAI({
  apiKey: OPENAI_API_KEY,
});

type CreateModelOptions = {
  model: LanguageModel;
  inputNanoDollarsPerToken: number;
  outputNanoDollarsPerToken: number;
};

const createModel = ({ model, inputNanoDollarsPerToken, outputNanoDollarsPerToken }: CreateModelOptions) => ({
  model,
  calculateCostInNanoDollars: ({ inputTokens = 0, outputTokens = 0 }: LanguageModelUsage) => {
    const inputCostInNanoDollars = inputTokens * inputNanoDollarsPerToken;
    const outputCostInNanoDollars = outputTokens * outputNanoDollarsPerToken;

    return inputCostInNanoDollars + outputCostInNanoDollars;
  },
});

// gpt-5.6-luna standard-tier, short-context pricing: https://developers.openai.com/api/docs/pricing
export const gpt56Luna = createModel({
  model: openai('gpt-5.6-luna'),
  inputNanoDollarsPerToken: 200,
  outputNanoDollarsPerToken: 1200,
});

// gemini-2.5-flash-lite pricing: https://ai.google.dev/gemini-api/docs/pricing
export const gemini25FlashLite = createModel({
  model: google('gemini-2.5-flash-lite'),
  inputNanoDollarsPerToken: 100,
  outputNanoDollarsPerToken: 400,
});
