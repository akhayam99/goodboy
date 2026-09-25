import type { IssueBrief, IssueBriefFailure } from '@goodboy/core';
import type {
  ProviderId,
  SessionExternalTaskProvider,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { IssueBriefsState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type IssueBriefSource = {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly identifier: string;
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly noun: string;
};

export type IssueBriefRoute = {
  readonly providerId: ProviderId;
  readonly model: string;
};

export type IssueBriefEntry =
  | { readonly status: 'unavailable'; readonly signature: string }
  | {
      readonly status: 'loading';
      readonly signature: string;
      readonly route: IssueBriefRoute;
    }
  | {
      readonly status: 'ready';
      readonly signature: string;
      readonly route: IssueBriefRoute;
      readonly brief: IssueBrief;
      readonly durationMs: number;
      readonly costUsd: number;
    }
  | {
      readonly status: 'failed';
      readonly signature: string;
      readonly route: IssueBriefRoute;
      readonly failure: IssueBriefFailure;
      readonly detail: string | null;
    };

export type RequestIssueBriefParams = {
  readonly source: IssueBriefSource;
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly isRetry?: boolean;
};

export type IssueBriefsSlice = IssueBriefsState & {
  requestIssueBrief(params: RequestIssueBriefParams): Promise<void>;
};
