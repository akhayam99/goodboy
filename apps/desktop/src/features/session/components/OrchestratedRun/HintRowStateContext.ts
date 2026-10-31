import { createContext, type MutableRefObject } from 'react';

export type HintRowViewState = {
  readonly isExpanded: boolean;
  readonly openImageId: string | null;
};

export type HintFocusMark = {
  readonly key: string;
  readonly control: string | null;
};

type PatchParams = {
  readonly key: string;
  readonly patch: Partial<HintRowViewState>;
};

export type HintRowStateValue = {
  readonly rows: Readonly<Record<string, HintRowViewState>>;
  readonly patch: (params: PatchParams) => void;
  readonly focusMark: MutableRefObject<HintFocusMark | null>;
};

export const HintRowStateContext = createContext<HintRowStateValue | null>(null);
