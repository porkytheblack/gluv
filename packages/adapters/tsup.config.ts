import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/openai/index.ts',
    'src/anthropic/index.ts',
    'src/vercel-ai/index.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ['@gluv/core', 'openai', '@anthropic-ai/sdk', 'ai'],
})
