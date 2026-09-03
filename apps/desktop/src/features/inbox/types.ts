import type { GithubIssue, SessionId } from '@goodboy/types';
import type { BitbucketPullRequest, BitbucketRepo } from '../integrations/bitbucket/client';
import type { GitlabIssue, GitlabMergeRequest } from '../integrations/gitlab/client';
import type { JiraIssue } from '../integrations/jira/client';
import type { LinearIssue } from '../integrations/linear/client';
import type { SentryIssue } from '../integrations/sentry/client';
import type { SlackChannel, SlackMessage } from '../integrations/slack/client';

export type InboxProvider =
  'github' | 'gitlab' | 'linear' | 'jira' | 'sentry' | 'slack' | 'bitbucket';

export const INBOX_PROVIDERS: ReadonlyArray<InboxProvider> = [
  'github',
  'gitlab',
  'linear',
  'jira',
  'sentry',
  'slack',
  'bitbucket',
];

export type InboxKind = 'issue' | 'pr' | 'mr' | 'thread' | 'error';

export const INBOX_KINDS: ReadonlyArray<InboxKind> = ['issue', 'pr', 'mr', 'thread', 'error'];

export type InboxState = 'open' | 'active' | 'done' | 'alert';

type Payload =
  | {
      readonly provider: 'github';
      readonly kind: 'issue';
      readonly issue: GithubIssue;
      readonly sessionId: SessionId | null;
    }
  | {
      readonly provider: 'gitlab';
      readonly kind: 'issue';
      readonly issue: GitlabIssue;
      readonly sessionId: SessionId | null;
    }
  | {
      readonly provider: 'gitlab';
      readonly kind: 'mr';
      readonly mr: GitlabMergeRequest;
      readonly host: string | null;
    }
  | {
      readonly provider: 'linear';
      readonly kind: 'issue';
      readonly issue: LinearIssue;
      readonly sessionId: SessionId | null;
    }
  | {
      readonly provider: 'jira';
      readonly kind: 'issue';
      readonly issue: JiraIssue;
      readonly sessionId: SessionId | null;
    }
  | {
      readonly provider: 'sentry';
      readonly kind: 'error';
      readonly issue: SentryIssue;
      readonly sessionId: SessionId | null;
    }
  | {
      readonly provider: 'slack';
      readonly kind: 'thread';
      readonly channel: SlackChannel;
      readonly head: SlackMessage;
      readonly sessionId: SessionId | null;
    }
  | {
      readonly provider: 'bitbucket';
      readonly kind: 'pr';
      readonly pullRequest: BitbucketPullRequest;
      readonly repo: BitbucketRepo | null;
    };

export type InboxRecord = {
  readonly key: string;
  readonly provider: InboxProvider;
  readonly kind: InboxKind;
  readonly identifier: string;
  readonly title: string;
  readonly state: InboxState;
  readonly updatedAt: string;
  readonly url: string;
  readonly meta: string;
  readonly payload: Payload;
};
