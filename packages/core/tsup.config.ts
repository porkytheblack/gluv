import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/effect/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ['effect', 'zod'],
})
