import { useState } from 'react';
import type { IntegrationDraft, SessionId } from '@goodboy/types';
import { Button, cn, Textarea, tintClasses } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { slackUserNames } from '../../../integrations/slack/nameMaps';
import { slackThreadFirstLine } from '../../../integrations/slack/threadFormulas';
import { useSlackThread } from '../../../integrations/slack/useSlackThread';
import { useSlackThreadActions } from '../../../integrations/slack/useSlackThreadActions';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly draft: IntegrationDraft;
  readonly sessionId: SessionId;
};

export const SlackDraftCard = ({ draft, sessionId }: Props) => {
  const channelId = draft.target.channelId ?? '';
  const threadTs = draft.target.threadTs ?? '';
  const workspaceId = draft.workspaceId;
  const isEnabled = channelId !== '' && threadTs !== '';
  const thread = useSlackThread({ workspaceId, channelId, threadTs, isEnabled });
  const threadActions = useSlackThreadActions({ workspaceId, channelId, threadTs, isEnabled });
  const decideSessionSlackDraft = useAppStore((s) => s.decideSessionSlackDraft);
  const [body, setBody] = useState(draft.body);
  const [isEditing, setIsEditing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const tint = tintClasses('info');

  const rootMessage = thread.messages[0] ?? null;
  const rootAuthorName =
    rootMessage?.userId == null
      ? null
      : (slackUserNames({ users: thread.users }).get(rootMessage.userId) ?? rootMessage.userId);
  const quote =
    rootMessage == null
      ? null
      : `${rootAuthorName == null ? '' : `${rootAuthorName}: `}${slackThreadFirstLine({ text: rootMessage.text })}`;

  const handleSend = async (): Promise<void> => {
    if (threadActions.reply == null) {
      return;
    }
    setIsSending(true);
    try {
      await threadActions.reply(body);
      await decideSessionSlackDraft({ sessionId, draftId: draft.id, status: 'sent', body });
    } finally {
      setIsSending(false);
    }
  };

  const handleDiscard = (): void => {
    void decideSessionSlackDraft({ sessionId, draftId: draft.id, status: 'discarded' });
  };

  return (
    <TranscriptShell
      tone="info"
      variant="boxed"
      data-testid="slack-draft-card"
      className="flex flex-col gap-2 text-label"
    >
      <div className="flex items-center gap-2">
        <span className={cn('flex shrink-0 items-center', tint.icon)} aria-hidden>
          <CONCEPT_ICONS.slack size={ICON_SIZE.row} />
        </span>
        <span className="text-row text-foreground">Reply ready for #{thread.channelName}</span>
        <span className="text-secondary text-muted-foreground">waiting for you</span>
      </div>
      {quote == null ? null : (
        <p className="border-l-2 border-border-soft pl-2.5 text-secondary text-muted-foreground">
          {quote}
        </p>
      )}
      {isEditing ? (
        <Textarea
          autoGrow
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-label="Edit reply"
        />
      ) : (
        <p className="text-label text-foreground">{body}</p>
      )}
      {threadActions.error == null ? null : (
        <p className="text-label text-danger">{threadActions.error}</p>
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          isBusy={isSending}
          busyLabel="Sending…"
          onClick={() => void handleSend()}
        >
          Send
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isSending}
          onClick={() => setIsEditing((value) => !value)}
        >
          Edit
        </Button>
        <Button variant="ghost" size="sm" disabled={isSending} onClick={handleDiscard}>
          Discard
        </Button>
      </div>
    </TranscriptShell>
  );
};
