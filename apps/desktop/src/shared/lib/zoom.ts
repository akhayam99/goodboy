import { getCurrentWebview } from '@tauri-apps/api/webview';
import { appliedZoom } from './appliedZoom';
import { STORAGE_KEYS, persistedPref } from './storage-keys';

const MIN = 0.5;
const MAX = 2.5;
const ZOOM_STEP = 0.1;

type FactorParams = {
  readonly factor: number;
};

const clamp = ({ factor }: FactorParams): number => {
  const rounded = Math.round(factor * 100) / 100;
  return Math.min(MAX, Math.max(MIN, rounded));
};

const zoomPref = persistedPref<number>({
  key: STORAGE_KEYS.zoom,
  parse: (raw) => {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? clamp({ factor: parsed }) : undefined;
  },
  serialize: String,
  fallback: 1,
});

const applyZoom = async ({ factor }: FactorParams): Promise<void> => {
  const next = clamp({ factor });
  try {
    await getCurrentWebview().setZoom(next);
    appliedZoom.write({ factor: next });
    zoomPref.write(next);
  } catch {
    void 0;
  }
};

export const currentZoom = (): number => appliedZoom.read();

export const applyStoredZoom = async (): Promise<void> => {
  await applyZoom({ factor: zoomPref.read() });
};

export const zoomIn = async (): Promise<void> => {
  await applyZoom({ factor: appliedZoom.read() + ZOOM_STEP });
};

export const zoomOut = async (): Promise<void> => {
  await applyZoom({ factor: appliedZoom.read() - ZOOM_STEP });
};

export const zoomReset = async (): Promise<void> => {
  await applyZoom({ factor: 1 });
};
