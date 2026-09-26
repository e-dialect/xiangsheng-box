import { defineConfig } from 'vite';
import uniModule from '@dcloudio/vite-plugin-uni';
import alias from '@rollup/plugin-alias';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { h5NotFoundRoutePlugin } from './build/h5NotFoundRoutePlugin.mjs';

const projectRootDir = fileURLToPath(new URL('.', import.meta.url));
const uni = uniModule.default;
const h5DevServerPort = process.env.H5_DEV_SERVER_PORT
  ? Number(process.env.H5_DEV_SERVER_PORT)
  : null;

if (h5DevServerPort !== null && (
  !Number.isInteger(h5DevServerPort)
  || h5DevServerPort < 1
  || h5DevServerPort > 65535
)) {
  throw new Error(`H5_DEV_SERVER_PORT is invalid: ${process.env.H5_DEV_SERVER_PORT}`);
}

const isolatedH5Server = h5DevServerPort === null ? null : {
  name: 'guantou:h5-dev-server-port',
  enforce: 'post',
  config() {
    return {
      server: {
        port: h5DevServerPort,
        strictPort: true,
      },
    };
  },
};
// https://vitejs.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        // UniApp 5.24 and the aligned 5.26 batch still enter Sass through
        // legacy Vue SFC adapters on H5 and mp-weixin. Keep this upstream-only
        // deprecation scoped until a stable compiler release removes those
        // calls; dropping it makes both checked builds fail again.
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  plugins: [
    uni(),
    alias(),
    ...(isolatedH5Server ? [isolatedH5Server] : []),
    h5NotFoundRoutePlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRootDir, 'src'),
    },
  },
});
