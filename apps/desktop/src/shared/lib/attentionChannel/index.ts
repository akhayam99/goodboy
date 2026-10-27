import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { WorkspaceId } from '@goodboy/types';
import { isTauriRuntime } from '../isTauriRuntime';

const ATTENTION_EVENT = 'goodboy:attention';

const ORIGIN = globalThis.crypto?.randomUUID?.() ?? `window-${Math.random().toString(36).slice(2)}`;

export type AttentionReport = {
  readonly workspaceId: WorkspaceId;
  readonly count: number;
  readonly tone: 'danger' | 'warning' | null;
  readonly reasonWords: ReadonlyArray<string>;
};

type Announcement = AttentionReport & {
  readonly origin: string;
};

type AnnounceParams = {
  readonly report: AttentionReport;
};

type ReportParams = {
  readonly report: AttentionReport;
};

type ListenParams = {
  readonly onReport: (params: ReportParams) => void;
};

export const announceAttention = ({ report }: AnnounceParams): Promise<void> => {
  if (!isTauriRuntime()) {
    return Promise.resolve();
  }
  const announcement: Announcement = { ...report, origin: ORIGIN };
  return emit(ATTENTION_EVENT, announcement);
};

export const listenAttention = async ({ onReport }: ListenParams): Promise<UnlistenFn> => {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<Announcement>(ATTENTION_EVENT, (event) => {
    const { origin, ...report } = event.payload;
    if (origin === ORIGIN) {
      return;
    }
    onReport({ report });
  });
};
