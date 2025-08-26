import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Support deploying under a sub-path (e.g., GitHub Pages /<repo>/)
// Use VITE_BASE_PATH env (in Actions or local .env) to override if needed.
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
});
