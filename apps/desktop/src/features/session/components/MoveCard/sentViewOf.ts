import type { SentToLead } from '../../../../store/slices/send-to-lead/state';

export type SentView = 'none' | 'quiet' | 'line';

type Params = {
  readonly entry: SentToLead | undefined;
};

export const sentViewOf = ({ entry }: Params): SentView => {
  if (entry === undefined) {
    return 'none';
  }
  if (entry.phase === 'sent' || entry.phase === 'stopped') {
    return 'quiet';
  }
  if (entry.phase === 'sending') {
    return entry.isNew ? 'quiet' : 'none';
  }
  return 'line';
};
