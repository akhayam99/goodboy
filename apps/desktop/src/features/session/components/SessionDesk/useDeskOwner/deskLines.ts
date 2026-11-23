import type { SessionId } from '@goodboy/types';
import type { OpenDrawer } from '../../../../../store/slices/drawer/state';

export type DeskLine = 'closed' | 'open-elsewhere' | 'moved';

type Listener = () => void;

type SessionParams = {
  readonly sessionId: SessionId;
};

type LineParams = SessionParams & {
  readonly line: DeskLine;
};

type KeepParams = SessionParams & {
  readonly tools: ReadonlyArray<OpenDrawer>;
};

type HolderParams = SessionParams & {
  readonly holder: string | null;
};

type ListenerParams = {
  readonly listener: Listener;
};

const NO_TOOLS: ReadonlyArray<OpenDrawer> = [];

const lines = new Map<SessionId, DeskLine>();
const kept = new Map<SessionId, ReadonlyArray<OpenDrawer>>();
const holders = new Map<SessionId, string | null>();
const landings = new Set<SessionId>();
const listeners = new Set<Listener>();

const announce = (): void => {
  listeners.forEach((listener) => listener());
};

export const deskLines = {
  lineOf: ({ sessionId }: SessionParams): DeskLine | null => lines.get(sessionId) ?? null,
  show: ({ sessionId, line }: LineParams): void => {
    if (lines.get(sessionId) === line) {
      return;
    }
    lines.set(sessionId, line);
    announce();
  },
  clear: ({ sessionId }: SessionParams): void => {
    if (lines.delete(sessionId)) {
      announce();
    }
  },
  keep: ({ sessionId, tools }: KeepParams): void => {
    kept.set(sessionId, tools);
  },
  keptOf: ({ sessionId }: SessionParams): ReadonlyArray<OpenDrawer> =>
    kept.get(sessionId) ?? NO_TOOLS,
  dropKept: ({ sessionId }: SessionParams): void => {
    kept.delete(sessionId);
  },
  noteHolder: ({ sessionId, holder }: HolderParams): void => {
    holders.set(sessionId, holder);
  },
  holderOf: ({ sessionId }: SessionParams): string | null => holders.get(sessionId) ?? null,
  requestLanding: ({ sessionId }: SessionParams): void => {
    landings.add(sessionId);
    announce();
  },
  takeLanding: ({ sessionId }: SessionParams): boolean => landings.delete(sessionId),
  subscribe: ({ listener }: ListenerParams): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  reset: (): void => {
    lines.clear();
    kept.clear();
    holders.clear();
    landings.clear();
    announce();
  },
};
