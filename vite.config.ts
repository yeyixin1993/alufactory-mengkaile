import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode, isSsrBuild }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        strictPort: true,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://127.0.0.1:5001',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      build: {
        // Verification runs (`vite build --ssr scripts/verify-*.ts --outDir .verify-*`)
        // only need the bundled script. Vite would otherwise copy the whole
        // `public/` folder — catalog HTML, fonts, images and the 3D models,
        // roughly 210 MB — into every verification output directory. That filled
        // the disk with identical copies of the same assets and, whenever an
        // output folder was not git-ignored, showed up in GitHub Desktop as
        // hundreds of "new" images to upload. The shipped app build is a normal
        // (non-SSR) build, so it keeps copying `public/` exactly as before.
        copyPublicDir: !isSsrBuild,
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
