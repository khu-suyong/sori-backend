import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
    },
    setupFiles: [
      'test/setup/vitest.setup.ts',
    ],
  },
});
