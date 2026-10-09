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

type FactParams = {
  readonly entry: PaletteEntry;
  readonly subject: string | null;
};

export const previewFactCountOf = ({ entry, subject }: FactParams): number => {
  const facts = [
    entry.target !== undefined,
    entry.kind === 'artifact',
    entry.kind === 'verb'
      ? subject !== null
      : (entry.tag ?? '') !== '' || (entry.detail ?? '') !== '',
    entry.shortcut !== undefined,
    entry.action?.blockedReason != null,
    entry.action?.confirm != null,
  ];
  return facts.reduce((count, isFact) => (isFact ? count + 1 : count), 0);
};
