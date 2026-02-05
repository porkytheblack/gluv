import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/hooks/index.ts', 'src/components/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: [
    'react',
    'react-dom',
    'react-hook-form',
    '@hookform/resolvers',
    '@tanstack/react-query',
    'zod',
    '@gluv/core',
  ],
})
