/// <reference types="vite/client" />

import type { Api } from '@backend/preload';

declare global {
  interface Window {
    api: Api;
  }
}

export {};