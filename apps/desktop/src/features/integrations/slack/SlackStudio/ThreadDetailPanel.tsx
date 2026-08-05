import { useEffect, useState } from 'react';
import { EmptyState } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { LaunchSessionPanel } from '../../components/LaunchSessionPanel';
import { slackGetPermalink } from '../client';
import { goalFromThread } from '../goal-from-thread';
import { slackUserNames } from '../nameMaps';
import { SlackThreadDetail } from '../SlackThreadDetail';
import {
  slackThreadBranchSlug,
  slackThreadExternalId,
  slackThreadIdentifier,
  slackThreadTitle,
} from '../threadFormulas';
import { useSlackThread } from '../useSlackThread';
import type { SlackThreadRow } from './useSlackThreads';

type Props = {
  readonly row: SlackThreadRow | null;
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly onClose: () => void;
};

export const ThreadDetailPanel = ({ row, workspaceId, sessionId, onClose }: Props) => {
  const channelId = row?.channel.id ?? '';
  const threadTs = row?.head.threadTs ?? row?.head.ts ?? '';
  const [permalink, setPermalink] = useState<string | null>(null);
  const thread = useSlackThread({
    workspaceId,
    channelId,
    threadTs,
    isEnabled: channelId !== '' && threadTs !== '',
  });

  useEffect(() => {
    setPermalink(null);
    if (channelId === '' || threadTs === '') {
      return;
    }
    let isCurrent = true;
    void slackGetPermalink({ workspaceId, channelId, messageTs: threadTs })
      .then((url) => {
        if (isCurrent) {
          setPermalink(url);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [workspaceId, channelId, threadTs]);

  if (row == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.slack}
          icon={CONCEPT_ICONS.slack}
          title="No thread selected"
          description="Pick a thread to read it and launch a session from it."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const channelName = row.channel.name;
  const rootText = row.head.text;
  const messages = thread.messages.length > 0 ? thread.messages : [row.head];

  return (
    <SlackThreadDetail
      channelName={channelName}
      rootText={rootText}
      url={permalink}
      messages={messages}
      users={thread.users}
      channels={thread.channels}
      isLoading={thread.isLoading}
      error={thread.error}
      onRetry={thread.refetch}
      dock={
        <LaunchSessionPanel
          key={`${channelId}:${threadTs}`}
          workspaceId={workspaceId}
          linkedSessionId={sessionId}
          goalSeed={goalFromThread({
            channelName,
            messages,
            userNames: slackUserNames({ users: thread.users }),
          })}
          branchSlugSeed={slackThreadBranchSlug({ text: rootText })}
          externalTask={{
            provider: 'slack',
            externalId: slackThreadExternalId({ channelId, threadTs }),
            identifier: slackThreadIdentifier({ channelName, text: rootText }),
            url: permalink ?? '',
            title: slackThreadTitle({ text: rootText }),
          }}
          onClose={onClose}
        />
      }
    />
  );
};
