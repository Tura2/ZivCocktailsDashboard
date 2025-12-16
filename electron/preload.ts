import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('ziv', {
  version: '0.0.1',
});

declare global {
  interface Window {
    ziv?: {
      version: string;
    };
  }
}
