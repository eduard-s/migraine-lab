import { defineConfig } from 'vite'

export default defineConfig({
  root: 'demo',
  base: './',
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /three\.core\.js$/, includeDependenciesRecursively: false },
            { name: 'three-renderer', test: /three\.module\.js$/, includeDependenciesRecursively: false },
          ],
        },
      },
    },
  },
})
