import type { PaletteEntry } from '../../types';

export const PALETTE_MIN_HEIGHT_PX = 480;

type LayoutParams = {
  readonly hasPreview: boolean;
};

type Layout = {
  readonly minHeightPx: number;
  readonly previewShown: boolean;
};

export const paletteBodyLayoutOf = ({ hasPreview }: LayoutParams): Layout => ({
  minHeightPx: PALETTE_MIN_HEIGHT_PX,
  previewShown: hasPreview,
});

type PreviewParams = {
  readonly entry: PaletteEntry;
};

const OWN_FACT_TARGETS: ReadonlySet<string> = new Set(['session', 'agent']);

export const hasOwnPreviewOf = ({ entry }: PreviewParams): boolean =>
  (entry.target !== undefined && OWN_FACT_TARGETS.has(entry.target.kind)) ||
  entry.kind === 'artifact' ||
  entry.action?.blockedReason != null ||
  entry.action?.confirm != null;
