import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    benchmark: {
      include: ['test/benchmark/**/*.bench.ts'],
    },
    environment: 'node',
    include: ['test/{unit,integration}/**/*.test.ts'],
  },
});
