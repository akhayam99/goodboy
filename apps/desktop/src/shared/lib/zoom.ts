import { getCurrentWebview } from '@tauri-apps/api/webview';
import { STORAGE_KEYS, persistedPref } from './storage-keys';

const MIN = 0.5;
const MAX = 2.5;
const ZOOM_STEP = 0.1;

function clamp(factor: number): number {
  const rounded = Math.round(factor * 100) / 100;
  return Math.min(MAX, Math.max(MIN, rounded));
}

const zoomPref = persistedPref<number>({
  key: STORAGE_KEYS.zoom,
  parse: (raw) => {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? clamp(parsed) : undefined;
  },
  serialize: String,
  fallback: 1,
});

function readZoom(): number {
  return zoomPref.read();
}

async function applyZoom(factor: number): Promise<void> {
  const next = clamp(factor);
  try {
    await getCurrentWebview().setZoom(next);
    zoomPref.write(next);
  } catch {
    void 0;
  }
}

export const currentZoom = (): number => readZoom();

export const applyStoredZoom = async (): Promise<void> => {
  await applyZoom(readZoom());
};

export const zoomIn = async (): Promise<void> => {
  await applyZoom(readZoom() + ZOOM_STEP);
};

export const zoomOut = async (): Promise<void> => {
  await applyZoom(readZoom() - ZOOM_STEP);
};

export const zoomReset = async (): Promise<void> => {
  await applyZoom(1);
};
