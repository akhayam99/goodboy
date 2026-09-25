import { useEffect, useMemo, useState } from 'react';
import { Notice } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import { resolveFacts, slackThreadFields } from '../../../../shared/detail-fields';
import { RecordFacts } from '../../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../../shared/components/StudioDetail/RecordSections';
import { slackGetPermalink, type SlackMessage } from '../client';
import { buildThreadProperties } from '../buildThreadProperties';
import { slackChannelNames, slackUserNames } from '../nameMaps';
import { slackThreadTitle } from '../threadFormulas';
import { useConversationPane } from '../../../../shared/components/Conversation/useConversationPane';
import type { ConversationSource } from '../../../../shared/components/Conversation/types';
import { SLACK_THREAD_CAPABILITIES, slackConversation } from '../slackConversation';
import { ThreadReactions } from '../ThreadReactions';
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
  const facts = useMemo(
    () =>
      resolveFacts({
        registry: slackThreadFields,
        entity: buildThreadProperties({ channelName, messages, userNames }),
      }),
    [channelName, messages, userNames],
  );
  const channels = thread.channels;
  const reply = actions.reply;
  const react = actions.react;
  const isWriting = actions.isWriting;
  const source = useMemo<ConversationSource>(() => {
    const byTs = new Map(messages.map((message) => [message.ts, message]));
    return {
      toolLabel: 'Slack',
      threads: slackConversation({
        messages,
        usersById: new Map(users.map((user) => [user.id, user])),
        userNames,
        channelNames: slackChannelNames({ channels }),
      }),
      capabilities: SLACK_THREAD_CAPABILITIES,
      isLoading: thread.isLoading,
      error: thread.error,
      onRetry: thread.refetch,
      onPost: reply == null ? null : ({ body }) => reply(body),
      onResolve: null,
      resolveError: null,
      emptyDescription: 'The messages in this thread show up here.',
      footnote: null,
      composerNote: 'Sent as plain text by the connected bot, not by you.',
      renderMessageFooter: (message) => {
        const original = byTs.get(message.id);
        if (original == null) {
          return null;
        }
        return (
          <ThreadReactions
            messageTs={original.ts}
            reactions={original.reactions}
            isWriting={isWriting}
            onReact={react}
          />
        );
      },
    };
  }, [
    messages,
    users,
    userNames,
    channels,
    thread.isLoading,
    thread.error,
    thread.refetch,
    reply,
    react,
    isWriting,
  ]);
  const conversation = useConversationPane({ source, resetKey: `${channelId}:${threadTs}` });
  const rootText = messages[0]?.text ?? '';
  const title = slackThreadTitle({ text: rootText });

  return (
    <PaneShell
      scroll="body"
      dock={conversation.composer}
      header={
        <RecordHeader
          provider="slack"
          identifier={`#${channelName}`}
          title={title !== '' ? title : `#${channelName}`}
          facts={<RecordFacts facts={facts} />}
          frame={frame}
          externalRef={
            permalink != null && permalink !== '' ? { url: permalink, label: 'thread' } : null
          }
        />
      }
    >
      {actions.error == null ? null : (
        <Notice
          tone="danger"
          placement="inline"
          title="Slack refused the reaction"
          body={actions.error}
        />
      )}
      <RecordSections sections={[conversation.section]} />
    </PaneShell>
  );
};
