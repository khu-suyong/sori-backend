import { describe, expect, it } from 'vitest';

import { app } from '../../src/app';

describe('GET /api/v1/health', () => {
  it('returns a healthy status payload', async () => {
    const response = await app.request('/api/v1/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ ok: true });
  });
});
