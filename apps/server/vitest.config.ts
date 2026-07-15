import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // node:sqlite + strip-types both work under vitest's esbuild transform.
  },
});
