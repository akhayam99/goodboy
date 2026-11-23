import type { MountId, SessionId } from '@goodboy/types';
import type { LeadCandidate } from '../../../features/work/sendToLead/leadCandidatesOf';
import type { SendToLeadState, SentToLead } from './state';

export type SendToLeadItem = Readonly<{
  key: string;
  sessionId: SessionId;
  text: string;
  note: string;
  threadId: string | null;
  mountId: MountId | null;
  branch: string | null;
}>;

export type SendToLeadParams = SendToLeadItem &
  Readonly<{
    candidate: LeadCandidate;
  }>;

export type SentKeyParams = Readonly<{
  key: string;
}>;

export type RecordSentParams = Readonly<{
  entry: SentToLead;
}>;

export type PatchSentParams = Readonly<{
  key: string;
  messageId: string;
  patch: Partial<SentToLead>;
}>;

export type SendToLeadSlice = SendToLeadState & {
  sendToLead(params: SendToLeadParams): Promise<void>;
  undoSendToLead(params: SentKeyParams): Promise<void>;
  retrySendToLead(params: SentKeyParams): Promise<void>;
  recordSentToLead(params: RecordSentParams): void;
  patchSentToLead(params: PatchSentParams): void;
  dismissSentToLead(params: SentKeyParams): void;
};
