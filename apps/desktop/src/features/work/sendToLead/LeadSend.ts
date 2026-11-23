import type { SendToLeadItem } from '../../../store/slices/send-to-lead/types';
import type { LeadItem } from './leadCandidatesOf';

type NoteParams = {
  readonly note: string;
};

export type LeadSend = Readonly<{
  identity: string;
  lead: LeadItem;
  send: Omit<SendToLeadItem, 'key' | 'note' | 'text'>;
  textOf: (params: NoteParams) => string;
}>;
