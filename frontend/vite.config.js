import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(async ({ command, mode }) => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const env = loadEnv(mode, root, ['API_PROXY_TARGET', 'PORT']);
  let target = process.env.API_PROXY_TARGET || env.API_PROXY_TARGET;
  if (!target && command === 'serve') {
    const local = 'http://127.0.0.1:8002';
    try {
      const response = await fetch(local + '/api/health', {signal:AbortSignal.timeout(1000)});
      if (response.ok) target = local;
    } catch {
      // The backend may be running only inside Docker Compose.
    }
    target ||= 'http://127.0.0.1:' + (process.env.PORT || env.PORT || '8080');
  }
  return {
    server: {
      proxy: { '/api': target || 'http://127.0.0.1:8002' },
    },
  };
});
