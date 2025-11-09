import { beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';

process.env.GOOGLE_CLIENT_ID ||= 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-client-secret';
process.env.GOOGLE_CLIENT_REDIRECT_URI ||= 'http://localhost:3000/api/v1/auth/google/callback';

import '../mocks/oauth';
import '../mocks/db';

import { resetOauthMock } from '../mocks/oauth';
import { resetTestDatabase, setupTestDatabase, teardownTestDatabase } from '../mocks/db';

beforeAll(async () => {
  await setupTestDatabase();
}, 60000);

beforeEach(async () => {
  resetOauthMock();
  await resetTestDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await teardownTestDatabase();
});
