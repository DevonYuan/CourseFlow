// Type declarations for Electron contextBridge API
// This extends the Window interface to include the `api` property exposed by the preload script.

import type { Api } from '@backend/preload';

declare global {
  interface Window {
    api: Api;
  }
}

export {};