import type { ReactNode } from 'react';

export const ROW_CARD_REST_MS = 800;

export type TimelineRowIdentity = {
  readonly roleLabel: string | null;
  readonly summary: string | null;
  readonly hasGlyph: boolean;
  readonly card: ReactNode;
};
