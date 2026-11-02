import type { PaletteEntry } from '../../types';

export const PALETTE_MIN_HEIGHT_PX = 320;

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

export const PALETTE_ROW_PX = 28;
export const PALETTE_SECTION_PX = 24;
export const PALETTE_LIST_PAD_PX = 4;

type SectionShape = {
  readonly hasTitle: boolean;
  readonly rowCount: number;
};

type ListHeightParams = {
  readonly sections: ReadonlyArray<SectionShape>;
};

export const paletteListMaxHeightOf = ({ sections }: ListHeightParams): number => {
  const limit = PALETTE_MIN_HEIGHT_PX - PALETTE_LIST_PAD_PX;
  const total =
    sections.reduce(
      (sum, section) =>
        sum + (section.hasTitle ? PALETTE_SECTION_PX : 0) + section.rowCount * PALETTE_ROW_PX,
      0,
    ) +
    PALETTE_LIST_PAD_PX * 2;
  if (total <= PALETTE_MIN_HEIGHT_PX) {
    return PALETTE_MIN_HEIGHT_PX;
  }
  let used = PALETTE_LIST_PAD_PX;
  let snapped = used;
  for (const section of sections) {
    if (section.hasTitle) {
      used += PALETTE_SECTION_PX;
    }
    for (let row = 0; row < section.rowCount; row += 1) {
      if (used + PALETTE_ROW_PX > limit) {
        return snapped + PALETTE_LIST_PAD_PX;
      }
      used += PALETTE_ROW_PX;
      snapped = used;
    }
  }
  return snapped + PALETTE_LIST_PAD_PX;
};

type PreviewParams = {
  readonly entry: PaletteEntry;
};

const OWN_FACT_KINDS: ReadonlySet<string> = new Set(['session', 'agent', 'artifact']);

export const hasOwnPreviewOf = ({ entry }: PreviewParams): boolean =>
  OWN_FACT_KINDS.has(entry.kind) ||
  entry.action?.blockedReason != null ||
  entry.action?.confirm != null;
