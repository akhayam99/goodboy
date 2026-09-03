import type { WorkspaceId } from '@goodboy/types';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import { goalFromIssue as goalFromGithubIssue } from '../../../github/goal-from-issue';
import { goalFromIssue as goalFromGitlabIssue } from '../../../integrations/gitlab/goal-from-issue';
import { goalFromMergeRequest } from '../../../integrations/gitlab/goal-from-merge-request';
import { goalFromIssue as goalFromLinearIssue } from '../../../integrations/linear/goal-from-issue';
import { goalFromIssue as goalFromJiraIssue } from '../../../integrations/jira/goal-from-issue';
import { goalFromSentry } from '../../../integrations/sentry/goal-from-sentry';
import { goalFromThread } from '../../../integrations/slack/goal-from-thread';
import {
  slackThreadExternalId,
  slackThreadIdentifier,
  slackThreadTitle,
} from '../../../integrations/slack/threadFormulas';
import { goalFromPullRequest } from '../../../integrations/bitbucket/goal-from-pull-request';
import { bitbucketPrIdentifier } from '../../../integrations/bitbucket/bitbucketPrIdentifier';
import { bitbucketPrUrl } from '../../../integrations/bitbucket/bitbucketPrUrl';
import { issueIdentifier } from '../../../integrations/gitlab/client';
import type { InboxRecord } from '../../types';

type Props = {
  readonly record: InboxRecord;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

export const RecordLaunchDock = ({ record, workspaceId, onClose }: Props) => {
  const payload = record.payload;

  switch (payload.provider) {
    case 'github':
      return (
        <LaunchSessionPanel
          workspaceId={workspaceId}
          linkedSessionId={payload.sessionId}
          goalSeed={goalFromGithubIssue({ issue: payload.issue })}
          externalTask={{
            provider: 'github',
            externalId: String(payload.issue.number),
            identifier: `#${payload.issue.number}`,
            url: payload.issue.url,
            title: payload.issue.title,
          }}
          onClose={onClose}
        />
      );
    case 'gitlab':
      switch (payload.kind) {
        case 'issue':
          return (
            <LaunchSessionPanel
              workspaceId={workspaceId}
              linkedSessionId={payload.sessionId}
              goalSeed={goalFromGitlabIssue(payload.issue)}
              externalTask={{
                provider: 'gitlab',
                externalId: String(payload.issue.id),
                identifier: issueIdentifier(payload.issue),
                url: payload.issue.webUrl,
                title: payload.issue.title,
              }}
              onClose={onClose}
            />
          );
        case 'mr':
          return (
            <LaunchSessionPanel
              workspaceId={workspaceId}
              linkedSessionId={null}
              goalSeed={goalFromMergeRequest({ mergeRequest: payload.mr })}
              externalTask={{
                provider: 'gitlab',
                externalId: String(payload.mr.id),
                identifier: `!${payload.mr.iid}`,
                url: payload.mr.webUrl,
                title: payload.mr.title,
              }}
              onClose={onClose}
            />
          );
        default: {
          const exhaustive: never = payload;
          return exhaustive;
        }
      }
    case 'linear':
      return (
        <LaunchSessionPanel
          workspaceId={workspaceId}
          linkedSessionId={payload.sessionId}
          goalSeed={goalFromLinearIssue(payload.issue)}
          externalTask={{
            provider: 'linear',
            externalId: payload.issue.id,
            identifier: payload.issue.identifier,
            url: payload.issue.url,
            title: payload.issue.title,
          }}
          onClose={onClose}
        />
      );
    case 'jira':
      return (
        <LaunchSessionPanel
          workspaceId={workspaceId}
          linkedSessionId={payload.sessionId}
          goalSeed={goalFromJiraIssue({ issue: payload.issue })}
          externalTask={{
            provider: 'jira',
            externalId: payload.issue.id,
            identifier: payload.issue.key,
            url: payload.issue.url,
            title: payload.issue.summary,
          }}
          onClose={onClose}
        />
      );
    case 'sentry':
      return (
        <LaunchSessionPanel
          workspaceId={workspaceId}
          linkedSessionId={payload.sessionId}
          goalSeed={goalFromSentry(payload.issue)}
          externalTask={{
            provider: 'sentry',
            externalId: payload.issue.id,
            identifier: payload.issue.shortId ?? payload.issue.id,
            url: payload.issue.permalink ?? '',
            title: payload.issue.title,
          }}
          onClose={onClose}
        />
      );
    case 'slack': {
      const threadTs = payload.head.threadTs ?? payload.head.ts;
      return (
        <LaunchSessionPanel
          workspaceId={workspaceId}
          linkedSessionId={payload.sessionId}
          goalSeed={goalFromThread({ channelName: payload.channel.name, messages: [payload.head] })}
          externalTask={{
            provider: 'slack',
            externalId: slackThreadExternalId({ channelId: payload.channel.id, threadTs }),
            identifier: slackThreadIdentifier({
              channelName: payload.channel.name,
              text: payload.head.text,
            }),
            url: record.url,
            title: slackThreadTitle({ text: payload.head.text }),
          }}
          onClose={onClose}
        />
      );
    }
    case 'bitbucket': {
      if (payload.repo == null) {
        return null;
      }
      const identifier = bitbucketPrIdentifier({
        repo: payload.repo,
        pullRequest: payload.pullRequest,
      });
      return (
        <LaunchSessionPanel
          workspaceId={workspaceId}
          linkedSessionId={null}
          goalSeed={goalFromPullRequest({ pullRequest: payload.pullRequest })}
          externalTask={{
            provider: 'bitbucket',
            externalId: identifier,
            identifier,
            url: bitbucketPrUrl({ repo: payload.repo, pullRequest: payload.pullRequest }),
            title: payload.pullRequest.title,
          }}
          onClose={onClose}
        />
      );
    }
    default: {
      const exhaustive: never = payload;
      return exhaustive;
    }
  }
};
