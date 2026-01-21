import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite plugin to handle trailing slash redirect
const trailingSlashRedirect = () => {
  return {
    name: 'trailing-slash-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // If the request is exactly /voice (without trailing slash), redirect to /voice/
        if (req.url === '/voice') {
          res.writeHead(301, { Location: '/voice/' });
          res.end();
          return;
        }
        next();
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), trailingSlashRedirect()],
  // App is hosted at https://evolra.ai/voice/
  base: '/voice/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
