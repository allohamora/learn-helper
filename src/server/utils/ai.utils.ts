import '@tanstack/react-start/server-only';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel, LanguageModelUsage } from 'ai';
import { OPENROUTER_API_KEY } from '../config';

const openrouter = createOpenRouter({
  apiKey: OPENROUTER_API_KEY,
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

// openai/gpt-6-luna short-context pricing: https://openrouter.ai/openai/gpt-6-luna
export const gpt6Luna = createModel({
  model: openrouter('openai/gpt-6-luna'),
  inputNanoDollarsPerToken: 100,
  outputNanoDollarsPerToken: 500,
});

// anthropic/claude-haiku-5.5 short-context pricing: https://openrouter.ai/anthropic/claude-haiku-5.5
export const claudeHaiku55 = createModel({
  model: openrouter('anthropic/claude-haiku-5.5'),
  inputNanoDollarsPerToken: 100,
  outputNanoDollarsPerToken: 500,
});
