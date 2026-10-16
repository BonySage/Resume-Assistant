import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

function contentSecurityPolicy(apiBaseUrl) {
  let apiOrigin = '';
  try {
    apiOrigin = new URL(apiBaseUrl).origin;
  } catch {
    // Relative API paths use the frontend origin.
  }

  const policy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
    "form-action 'self'",
  ].join('; ');

  return {
    name: 'frontend-content-security-policy',
    transformIndexHtml(html) {
      return html.replace('</head>', `  <meta http-equiv="Content-Security-Policy" content="${policy}" />\n  </head>`);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: './',
    plugins: [react(), ...(command === 'build' ? [contentSecurityPolicy(env.VITE_API_BASE_URL)] : [])],
    build: {
      sourcemap: false,
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
    },
  };
});
