import '@tanstack/react-start/server-only';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel, LanguageModelUsage } from 'ai';
import { OPENAI_API_KEY } from '../config';

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
export const luna = createModel({
  model: openai('gpt-5.6-luna'),
  inputNanoDollarsPerToken: 200,
  outputNanoDollarsPerToken: 1200,
});
