import { defineConfig } from 'vite';

export default defineConfig({
  // Yandex Games serves the uploaded archive from a game-specific path.
  // Relative asset URLs keep the production build working there.
  base: './',
});
