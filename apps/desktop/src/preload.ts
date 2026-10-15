import { contextBridge } from 'electron';

/**
 * Sandboxed preload: exposes a single read-only flag so the UI can
 * adapt to the desktop shell. No Node APIs leak into the page.
 */
contextBridge.exposeInMainWorld('zoveli', { desktop: true });
