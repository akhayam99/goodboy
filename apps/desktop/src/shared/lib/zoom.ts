import { getCurrentWebview } from '@tauri-apps/api/webview';

const STORAGE_KEY = 'goodboy:zoom';
const MIN = 0.5;
const MAX = 2.5;
export const ZOOM_STEP = 0.1;

function clamp(factor: number): number {
  const rounded = Math.round(factor * 100) / 100;
  return Math.min(MAX, Math.max(MIN, rounded));
}

function readZoom(): number {
  if (typeof localStorage === 'undefined') {
    return 1;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number.parseFloat(raw) : 1;
  return Number.isFinite(parsed) ? clamp(parsed) : 1;
}

async function applyZoom(factor: number): Promise<void> {
  const next = clamp(factor);
  try {
    await getCurrentWebview().setZoom(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(next));
    }
  } catch {
    void 0;
  }
}

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
