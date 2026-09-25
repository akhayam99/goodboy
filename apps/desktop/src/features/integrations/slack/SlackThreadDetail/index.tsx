import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import { DetailProperties } from '../../../../shared/components/StudioDetail/DetailProperties';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { resolveDetailFields, slackThreadFields } from '../../../../shared/detail-fields';
import { slackGetPermalink, type SlackMessage } from '../client';
import { buildThreadProperties } from '../buildThreadProperties';
import { slackUserNames } from '../nameMaps';
import { slackThreadTitle } from '../threadFormulas';
import { ThreadConversation } from '../ThreadConversation';
import { useSlackThread } from '../useSlackThread';
import { useSlackThreadActions } from '../useSlackThreadActions';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly channelId: string;
  readonly threadTs: string;
  readonly fallbackChannelName: string;
  readonly fallbackMessage: SlackMessage | null;
  readonly fallbackUrl?: string | null;
  readonly frame?: RecordFrame | null;
};

export const SlackThreadDetail = ({
  workspaceId,
  channelId,
  threadTs,
  fallbackChannelName,
  fallbackMessage,
  fallbackUrl = null,
  frame = null,
}: Props) => {
  const [permalink, setPermalink] = useState<string | null>(fallbackUrl);
  const isEnabled = channelId !== '' && threadTs !== '';
  const thread = useSlackThread({ workspaceId, channelId, threadTs, isEnabled });
  const actions = useSlackThreadActions({ workspaceId, channelId, threadTs, isEnabled });

  useEffect(() => {
    setPermalink(fallbackUrl);
    if (!isEnabled) {
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
  }, [workspaceId, channelId, threadTs, fallbackUrl, isEnabled]);

  const users = thread.users;
  const channelName = thread.channelName !== channelId ? thread.channelName : fallbackChannelName;
  const messages =
    thread.messages.length > 0 ? thread.messages : fallbackMessage == null ? [] : [fallbackMessage];
  const userNames = useMemo(() => slackUserNames({ users }), [users]);
  const properties = useMemo(
    () =>
      resolveDetailFields({
        registry: slackThreadFields,
        entity: buildThreadProperties({ channelName, messages, userNames }),
      }),
    [channelName, messages, userNames],
  );
  const rootText = messages[0]?.text ?? '';
  const title = slackThreadTitle({ text: rootText });

  return (
    <PaneShell
      scroll="body"
      header={
        <RecordHeader
          provider="slack"
          identifier={`#${channelName}`}
          title={title !== '' ? title : `#${channelName}`}
          frame={frame}
          externalRef={
            permalink != null && permalink !== '' ? { url: permalink, label: 'thread' } : null
          }
        />
      }
    >
      <DetailProperties entries={properties} />
      <ThreadConversation
        messages={messages}
        users={users}
        channels={thread.channels}
        isLoading={thread.isLoading}
        error={thread.error}
        onRetry={thread.refetch}
        actions={actions}
      />
    </PaneShell>
  );
};
