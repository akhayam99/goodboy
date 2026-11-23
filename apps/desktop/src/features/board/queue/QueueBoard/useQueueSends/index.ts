import { create } from 'zustand';

export const UNDO_WINDOW_MS = 10_000;

export type PendingSend = Readonly<{
  id: string;
  kind: 'answer' | 'message';
  agentId: string | null;
  moveId: string | null;
}>;

type QueueParams = {
  readonly send: PendingSend;
  readonly run: () => Promise<void>;
};

type IdParams = {
  readonly id: string;
};

type MoveParams = {
  readonly moveId: string;
};

type MovesParams = {
  readonly moveIds: ReadonlyArray<string>;
};

type QueueSends = {
  readonly pending: Readonly<Record<string, PendingSend>>;
  readonly notNow: ReadonlySet<string>;
  readonly queue: (params: QueueParams) => void;
  readonly cancel: (params: IdParams) => boolean;
  readonly flush: (params: IdParams) => void;
  readonly flushAll: () => void;
  readonly isWaiting: (params: IdParams) => boolean;
  readonly hide: (params: MoveParams) => void;
  readonly show: (params: MoveParams) => boolean;
  readonly showAll: (params: MovesParams) => void;
  readonly drafts: Readonly<Record<string, string>>;
  readonly setDraft: (params: DraftParams) => void;
  readonly restoreDraft: (params: DraftParams) => void;
  readonly answerDrafts: Readonly<Record<string, string>>;
  readonly setAnswerDraft: (params: AnswerDraftParams) => void;
  readonly restoreAnswerDraft: (params: AnswerDraftParams) => void;
};

type DraftParams = {
  readonly agentId: string;
  readonly text: string;
};

type AnswerDraftParams = {
  readonly questionId: string;
  readonly text: string;
};

type Timer = {
  readonly handle: ReturnType<typeof setTimeout>;
  readonly run: () => Promise<void>;
};

const timers = new Map<string, Timer>();

let isListeningForClose = false;

const flushOnClose = (): void => {
  if (isListeningForClose || typeof window === 'undefined') {
    return;
  }
  isListeningForClose = true;
  window.addEventListener('pagehide', () => useQueueSends.getState().flushAll());
};

type PendingParams = {
  readonly pending: Readonly<Record<string, PendingSend>>;
  readonly id: string;
};

const withoutPending = ({ pending, id }: PendingParams): Readonly<Record<string, PendingSend>> =>
  Object.fromEntries(Object.entries(pending).filter(([key]) => key !== id));

export const useQueueSends = create<QueueSends>((set, get) => ({
  pending: {},
  notNow: new Set(),
  queue: ({ send, run }) => {
    flushOnClose();
    const handle = setTimeout(() => get().flush({ id: send.id }), UNDO_WINDOW_MS);
    timers.set(send.id, { handle, run });
    set((state) => ({ pending: { ...state.pending, [send.id]: send } }));
  },
  cancel: ({ id }) => {
    const timer = timers.get(id);
    if (timer === undefined) {
      return false;
    }
    clearTimeout(timer.handle);
    timers.delete(id);
    set((state) => ({ pending: withoutPending({ pending: state.pending, id }) }));
    return true;
  },
  flush: ({ id }) => {
    const timer = timers.get(id);
    if (timer === undefined) {
      return;
    }
    clearTimeout(timer.handle);
    timers.delete(id);
    const settle = async () => {
      try {
        await timer.run();
      } finally {
        set((state) => ({ pending: withoutPending({ pending: state.pending, id }) }));
      }
    };
    void settle();
  },
  flushAll: () => {
    for (const id of [...timers.keys()]) {
      get().flush({ id });
    }
  },
  isWaiting: ({ id }) => timers.has(id),
  hide: ({ moveId }) => set((state) => ({ notNow: new Set([...state.notNow, moveId]) })),
  show: ({ moveId }) => {
    if (!get().notNow.has(moveId)) {
      return false;
    }
    set((state) => ({ notNow: new Set([...state.notNow].filter((id) => id !== moveId)) }));
    return true;
  },
  showAll: ({ moveIds }) => {
    const shown = new Set(moveIds);
    set((state) => ({ notNow: new Set([...state.notNow].filter((id) => !shown.has(id))) }));
  },
  drafts: {},
  setDraft: ({ agentId, text }) =>
    set((state) => ({ drafts: { ...state.drafts, [agentId]: text } })),
  restoreDraft: ({ agentId, text }) => {
    if ((get().drafts[agentId] ?? '') !== '') {
      return;
    }
    get().setDraft({ agentId, text });
  },
  answerDrafts: {},
  setAnswerDraft: ({ questionId, text }) =>
    set((state) => ({ answerDrafts: { ...state.answerDrafts, [questionId]: text } })),
  restoreAnswerDraft: ({ questionId, text }) => {
    if ((get().answerDrafts[questionId] ?? '') !== '') {
      return;
    }
    get().setAnswerDraft({ questionId, text });
  },
}));
