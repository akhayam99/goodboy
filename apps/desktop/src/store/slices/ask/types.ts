import type { ChatId, SessionId } from '@goodboy/types';
import type { AskRouting, AskState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type AskSessionParams = {
  readonly sessionId: SessionId;
};

export type ShowAskThreadParams = AskSessionParams & {
  readonly threadId: ChatId;
};

export type SendAskQuestionParams = AskSessionParams & {
  readonly question: string;
  readonly rightNow: ReadonlyArray<string>;
};

export type SetAskRoutingParams = AskSessionParams & {
  readonly routing: AskRouting;
};

export type AskSlice = AskState & {
  readonly loadAskThreads: (params: AskSessionParams) => Promise<void>;
  readonly showAskThread: (params: ShowAskThreadParams) => Promise<void>;
  readonly newAskThread: (params: AskSessionParams) => void;
  readonly sendAskQuestion: (params: SendAskQuestionParams) => Promise<boolean>;
  readonly stopAskReply: (params: AskSessionParams) => Promise<void>;
  readonly setAskRouting: (params: SetAskRoutingParams) => void;
  readonly openAsk: (params: AskSessionParams) => void;
};
