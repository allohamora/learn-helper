import './mocks';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { createMockServer } from './utils/mock-server.utils';

export const mockServer = createMockServer();

beforeAll(() => {
  mockServer.start();
});

afterEach(() => {
  expect(mockServer.onUnhandledRequest).not.toHaveBeenCalled();
  mockServer.onUnhandledRequest.mockClear();

  mockServer.clearHandlers();
});

afterAll(() => {
  mockServer.stop();
});
