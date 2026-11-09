import type { SessionId } from '@goodboy/types';
import type { BrowserTab } from '../../store/slices/browser/types';

export type BrowserTabFacts = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly url: string;
  readonly title: string;
  readonly isShown: boolean;
  readonly hiddenSinceMs: number | null;
  readonly openerId: string | null;
};

export type BrowserBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ShownTab = {
  readonly tab: BrowserTab;
  readonly isPin: boolean;
};

export type WantedView = {
  readonly tab: BrowserTab;
  readonly bounds: BrowserBounds;
};

type TabParams = {
  readonly tab: BrowserTab;
};

type TextParams = {
  readonly text: string;
};

type ErrorParams = {
  readonly error: unknown;
};

export type BrowserPaneModel = {
  readonly tabs: ReadonlyArray<BrowserTab>;
  readonly pins: ReadonlyArray<BrowserTab>;
  readonly projectName: string | null;
  readonly shown: ShownTab | null;
  readonly address: string;
  readonly titleOf: (params: TabParams) => string;
  readonly error: string | null;
  readonly isDrafting: boolean;
  readonly wakeAttempt: number;
  readonly submit: (params: TextParams) => Promise<boolean>;
  readonly back: () => void;
  readonly forward: () => void;
  readonly reload: () => void;
  readonly select: (params: TabParams) => void;
  readonly close: (params: TabParams) => void;
  readonly togglePin: () => void;
  readonly startDraft: () => void;
  readonly openOutside: () => void;
  readonly showError: (params: ErrorParams) => void;
};

export type OpenOutcome = 'opened' | 'stale' | 'failed';

export type BrowserAddress =
  | { readonly kind: 'ok'; readonly url: string }
  | { readonly kind: 'refused'; readonly reason: string };
