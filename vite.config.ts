import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: { outDir: mode === 'toss' ? 'dist-toss' : 'dist' },
}));
