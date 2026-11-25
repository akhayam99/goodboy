import { useState } from 'react';
import { CircleAlert } from '@goodboy/ui/icons';
import { ICON_SIZE, TruncatedText } from '@goodboy/ui';
import { useNow } from '../../../../shared/hooks/useNow';
import type { SessionId } from '@goodboy/types';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { useAppStore } from '../../../../store';
import { SendToLeadButton } from '../../../work/sendToLead/SendToLeadButton';
import { needsYouLinesOf } from '../../central/next/needsYouLinesOf';
import { MoveEvidenceChips } from './MoveEvidenceChips';
import { MoveVerb } from './MoveVerb';
import { NeedsYouTile } from './NeedsYouTile';
import { SentToLeadRow } from './SentToLeadRow';
import { sentViewOf } from './sentViewOf';
import { useMoveLeadSend } from './useMoveLeadSend';

type Props = {
  readonly sessionId: SessionId;
  readonly card: ActionCardModel;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
  readonly density: 'needs' | 'row';
  readonly isPrimary: boolean;
  readonly project: string | null;
};

export const MoveCard = ({
  sessionId,
  card,
  actionsFor,
  openFor,
  density,
  isPrimary,
  project,
}: Props) => {
  const { main, second, failure } = actionsFor({ card });
  const onOpen = openFor({ card });
  const why = card.reason ?? card.detail;
  const now = useNow(30_000);
  const leadSend = useMoveLeadSend({ sessionId, card });
  const sentKey = leadSend === null ? card.id : `${card.id}|${leadSend.identity}`;
  const sent = useAppStore((state) => state.sentToLead[sentKey]);
  const [editNote, setEditNote] = useState<string | null>(null);
  const onEdit = async () => {
    if (sent === undefined) {
      return;
    }
    await useAppStore.getState().undoSendToLead({ key: sentKey });
    if (useAppStore.getState().sentToLead[sentKey] === undefined) {
      setEditNote(sent.note);
    }
  };
  const sentView = sentViewOf({ entry: sent });
  if (sent !== undefined && sentView === 'quiet') {
    return (
      <div data-move={card.id} data-move-density={density} className="flex min-w-0 flex-col">
        <SentToLeadRow entry={sent} onEdit={() => void onEdit()} />
      </div>
    );
  }
  const sentLine =
    sent !== undefined && sentView === 'line' ? (
      <SentToLeadRow entry={sent} onEdit={() => void onEdit()} />
    ) : null;
  const restVariant = density === 'needs' ? 'quiet' : 'secondary';
  const verbs = (
    <span className="flex shrink-0 items-center gap-2">
      {leadSend === null || sent !== undefined ? null : (
        <SendToLeadButton
          cardKey={sentKey}
          send={leadSend}
          variant={restVariant}
          editNote={editNote}
        />
      )}
      {main === null ? null : (
        <MoveVerb
          verb={main}
          cardId={card.id}
          cardTitle={card.title}
          variant={isPrimary ? 'primary' : restVariant}
          isMain
          onOpen={onOpen}
        />
      )}
      {second === null || density === 'row' ? null : (
        <MoveVerb
          verb={second}
          cardId={card.id}
          cardTitle={card.title}
          variant={restVariant}
          isMain={false}
          onOpen={onOpen}
        />
      )}
    </span>
  );
  const failureLine =
    failure === null ? null : (
      <span role="alert" className="flex min-w-0 items-center gap-1 text-meta text-foreground">
        <CircleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0 text-danger" />
        <TruncatedText className="min-w-0">{failure}</TruncatedText>
      </span>
    );
  if (density === 'row') {
    return (
      <div
        data-move={card.id}
        data-sent-key={sentKey}
        data-move-density="row"
        data-move-primary={isPrimary ? '' : undefined}
        className="flex min-w-0 flex-col gap-1"
      >
        <div className="flex min-h-8 min-w-0 items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <TruncatedText className="min-w-0 text-ui text-foreground">{card.title}</TruncatedText>
            {why === null || why === '' ? null : (
              <TruncatedText className="min-w-0 text-meta text-muted-foreground">
                {why}
              </TruncatedText>
            )}
          </span>
          {verbs}
        </div>
        {failureLine}
        {sentLine}
      </div>
    );
  }
  const lines = needsYouLinesOf({ card, project, now });
  return (
    <NeedsYouTile
      moveId={card.id}
      sentKey={sentKey}
      isPrimary={isPrimary}
      title={lines.title}
      meta={lines.meta}
      actions={verbs}
      below={
        <>
          <MoveEvidenceChips sessionId={sessionId} evidence={card.evidence} />
          {failureLine}
          {sentLine}
        </>
      }
    />
  );
};
