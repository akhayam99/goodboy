import type { SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import type { IssueBriefSource } from '../../store/slices/issue-briefs/types';
import { goalFromIssue as goalFromGithubIssue } from '../github/goal-from-issue';
import { goalFromIssue as goalFromGitlabIssue } from '../integrations/gitlab/goal-from-issue';
import { goalFromMergeRequest } from '../integrations/gitlab/goal-from-merge-request';
import { goalFromIssue as goalFromLinearIssue } from '../integrations/linear/goal-from-issue';
import { goalFromIssue as goalFromJiraIssue } from '../integrations/jira/goal-from-issue';
import { goalFromSentry } from '../integrations/sentry/goal-from-sentry';
import { goalFromThread } from '../integrations/slack/goal-from-thread';
import {
  slackThreadExternalId,
  slackThreadIdentifier,
  slackThreadTitle,
} from '../integrations/slack/threadFormulas';
import { goalFromPullRequest } from '../integrations/bitbucket/goal-from-pull-request';
import { bitbucketPrIdentifier } from '../integrations/bitbucket/bitbucketPrIdentifier';
import { bitbucketPrUrl } from '../integrations/bitbucket/bitbucketPrUrl';
import { issueIdentifier } from '../integrations/gitlab/client';
import { issueBriefSourceFor } from './issueBriefSourceFor';
import type { InboxRecord } from './types';

export type LaunchExternalTask = {
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly identifier: string;
  readonly url: string;
  readonly title: string;
};

export type LaunchSpec = {
  readonly linkedSessionId: SessionId | null;
  readonly goalSeed: string;
  readonly externalTask: LaunchExternalTask;
  readonly briefSource: IssueBriefSource | null;
};

type Params = {
  readonly record: InboxRecord;
};

export const launchSpecFor = ({ record }: Params): LaunchSpec | null => {
  const payload = record.payload;
  switch (payload.provider) {
    case 'github': {
      const externalTask = {
        provider: 'github',
        externalId: String(payload.issue.number),
        identifier: `#${payload.issue.number}`,
        url: payload.issue.url,
        title: payload.issue.title,
      } satisfies LaunchExternalTask;
      return {
        linkedSessionId: payload.sessionId,
        goalSeed: goalFromGithubIssue({ issue: payload.issue }),
        externalTask,
        briefSource: issueBriefSourceFor({ task: externalTask, body: payload.issue.body }),
      };
    }
    case 'gitlab': {
      if (payload.kind === 'mr') {
        return {
          linkedSessionId: null,
          goalSeed: goalFromMergeRequest({ mergeRequest: payload.mr }),
          externalTask: {
            provider: 'gitlab',
            externalId: String(payload.mr.id),
            identifier: `!${payload.mr.iid}`,
            url: payload.mr.webUrl,
            title: payload.mr.title,
          },
          briefSource: null,
        };
      }
      const externalTask = {
        provider: 'gitlab',
        externalId: String(payload.issue.id),
        identifier: issueIdentifier(payload.issue),
        url: payload.issue.webUrl,
        title: payload.issue.title,
      } satisfies LaunchExternalTask;
      return {
        linkedSessionId: payload.sessionId,
        goalSeed: goalFromGitlabIssue({ issue: payload.issue }),
        externalTask,
        briefSource: issueBriefSourceFor({
          task: externalTask,
          body: payload.issue.description ?? '',
        }),
      };
    }
    case 'linear': {
      const externalTask = {
        provider: 'linear',
        externalId: payload.issue.id,
        identifier: payload.issue.identifier,
        url: payload.issue.url,
        title: payload.issue.title,
      } satisfies LaunchExternalTask;
      return {
        linkedSessionId: payload.sessionId,
        goalSeed: goalFromLinearIssue({ issue: payload.issue }),
        externalTask,
        briefSource: issueBriefSourceFor({
          task: externalTask,
          body: payload.issue.description ?? '',
        }),
      };
    }
    case 'jira': {
      const externalTask = {
        provider: 'jira',
        externalId: payload.issue.id,
        identifier: payload.issue.key,
        url: payload.issue.url,
        title: payload.issue.summary,
      } satisfies LaunchExternalTask;
      return {
        linkedSessionId: payload.sessionId,
        goalSeed: goalFromJiraIssue({ issue: payload.issue }),
        externalTask,
        briefSource: issueBriefSourceFor({ task: externalTask, body: payload.issue.description }),
      };
    }
    case 'sentry': {
      const goalSeed = goalFromSentry({ issue: payload.issue });
      const externalTask = {
        provider: 'sentry',
        externalId: payload.issue.id,
        identifier: payload.issue.shortId ?? payload.issue.id,
        url: payload.issue.permalink ?? '',
        title: payload.issue.title,
      } satisfies LaunchExternalTask;
      return {
        linkedSessionId: payload.sessionId,
        goalSeed,
        externalTask,
        briefSource: issueBriefSourceFor({ task: externalTask, body: goalSeed }),
      };
    }
    case 'slack': {
      const threadTs = payload.head.threadTs ?? payload.head.ts;
      const goalSeed = goalFromThread({
        channelName: payload.channel.name,
        messages: [payload.head],
      });
      const externalTask = {
        provider: 'slack',
        externalId: slackThreadExternalId({ channelId: payload.channel.id, threadTs }),
        identifier: slackThreadIdentifier({
          channelName: payload.channel.name,
          text: payload.head.text,
        }),
        url: record.url,
        title: slackThreadTitle({ text: payload.head.text }),
      } satisfies LaunchExternalTask;
      return {
        linkedSessionId: payload.sessionId,
        goalSeed,
        externalTask,
        briefSource: issueBriefSourceFor({ task: externalTask, body: goalSeed, noun: 'thread' }),
      };
    }
    case 'bitbucket': {
      if (payload.repo == null) {
        return null;
      }
      const identifier = bitbucketPrIdentifier({
        repo: payload.repo,
        pullRequest: payload.pullRequest,
      });
      return {
        linkedSessionId: null,
        goalSeed: goalFromPullRequest({ pullRequest: payload.pullRequest }),
        externalTask: {
          provider: 'bitbucket',
          externalId: identifier,
          identifier,
          url: bitbucketPrUrl({ repo: payload.repo, pullRequest: payload.pullRequest }),
          title: payload.pullRequest.title,
        },
        briefSource: null,
      };
    }
    default: {
      const exhaustive: never = payload;
      return exhaustive;
    }
  }
};
