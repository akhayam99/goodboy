import type { SetFn } from '../../slice-types';
import type { SentToLead } from './state';

type WriteParams = Readonly<{
  set: SetFn;
  entry: SentToLead;
}>;

export const writeSent = ({ set, entry }: WriteParams): void => {
  set((state) => ({ sentToLead: { ...state.sentToLead, [entry.key]: entry } }));
};

type PatchParams = Readonly<{
  set: SetFn;
  key: string;
  messageId: string;
  patch: Partial<SentToLead>;
}>;

export const patchSentIfCurrent = ({ set, key, messageId, patch }: PatchParams): void => {
  set((state) => {
    const current = state.sentToLead[key];
    if (current === undefined || current.messageId !== messageId) {
      return {};
    }
    return { sentToLead: { ...state.sentToLead, [key]: { ...current, ...patch } } };
  });
};

type DropParams = Readonly<{
  set: SetFn;
  key: string;
  messageId: string;
}>;

export const dropSentIfCurrent = ({ set, key, messageId }: DropParams): void => {
  set((state) => {
    const current = state.sentToLead[key];
    if (current === undefined || current.messageId !== messageId) {
      return {};
    }
    const next = { ...state.sentToLead };
    delete next[key];
    return { sentToLead: next };
  });
};
