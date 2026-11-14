import { createContext } from 'react';

export type HeadClaimParams = {
  readonly part: 'title' | 'heading';
  readonly isClaimed: boolean;
};

export type SessionHeadSlots = {
  readonly title: HTMLElement | null;
  readonly meta: HTMLElement | null;
  readonly aside: HTMLElement | null;
  readonly lead: HTMLElement | null;
  readonly frame: HTMLElement | null;
  readonly isTitleClaimed: boolean;
  readonly isHeadingClaimed: boolean;
  readonly setTitle: (node: HTMLElement | null) => void;
  readonly setMeta: (node: HTMLElement | null) => void;
  readonly claim: (params: HeadClaimParams) => void;
};

export const SessionHeadSlotsContext = createContext<SessionHeadSlots | null>(null);
