import type { ExtractedScribeText } from '@goodboy/core';
import type { AgentId, MountId, ProviderId, SessionId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export type ScribeTask =
  | {
      readonly kind: 'pr';
      readonly closedPrNumber: number | null;
      readonly references: ReadonlyArray<string>;
      readonly isDraft: boolean;
      readonly base: string | null;
    }
  | { readonly kind: 'pr-update'; readonly prNumber: number }
  | {
      readonly kind: 'commit-message';
      readonly verb: 'reword' | 'squash';
      readonly commits: ReadonlyArray<{ readonly sha: string; readonly subject: string }>;
    };

type ScribeStatus = 'writing' | 'ready' | 'creating' | 'created' | 'failed';

export type ScribeRequest = {
  readonly number: number;
  readonly url: string;
};

export type ScribeWork = {
  readonly key: string;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly agentId: AgentId | null;
  readonly task: ScribeTask;
  readonly status: ScribeStatus;
  readonly output: ExtractedScribeText | null;
  readonly error: string | null;
  readonly pullRequest: ScribeRequest | null;
  readonly updatedAt: number;
};

export type OpenScribePullRequestInput = {
  readonly key: string;
};

export type ResumeScribePullRequestInput = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly agentId: AgentId;
  readonly output: ExtractedScribeText;
};

export type RequestScribeInput = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly task: ScribeTask;
  readonly hint?: string;
  readonly routing?: {
    readonly provider: ProviderId | '';
    readonly model: string;
    readonly effort: string;
  };
};

export type SettleScribeInput = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly assistantText: string;
  readonly hasFailed: boolean;
};
