import { randomInt } from 'node:crypto';

export const randomElement = <T>(target: T[]): T => {
  const idx = randomInt(0, target.length);

  const element = target[idx];
  if (!element) {
    throw new Error('Element is not found');
  }

  return element;
};
