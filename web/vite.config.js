import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev only (apply: 'serve'): localhost has no backend, so POST /api/feedback is answered here. Nothing is sent or stored.
const feedbackStub = {
  name: 'visalife-feedback-stub',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/feedback', (req, res, next) => {
      if (req.method !== 'POST') return next();
      res.setHeader('Content-Type', 'application/json');
      res.end('{"ok":true}');
    });
  },
};

export default defineConfig({ plugins: [react(), feedbackStub] });
