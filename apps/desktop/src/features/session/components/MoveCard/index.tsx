import { useState } from 'react';
import { CircleAlert } from '@goodboy/ui/icons';
import { ICON_SIZE, TruncatedText } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { useAppStore } from '../../../../store';
import { SendToLeadButton } from '../../../work/sendToLead/SendToLeadButton';
import { MoveEvidenceChips } from './MoveEvidenceChips';
import { MoveVerb } from './MoveVerb';
import { SentToLeadRow } from './SentToLeadRow';
import { useMoveLeadSend } from './useMoveLeadSend';

type Props = {
  readonly sessionId: SessionId;
  readonly card: ActionCardModel;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly openFor: ActionCardActions['openFor'];
  readonly density: 'focus' | 'row';
  readonly isPrimary: boolean;
  readonly kicker: string | null;
};

export const MoveCard = ({
  sessionId,
  card,
  actionsFor,
  openFor,
  density,
  isPrimary,
  kicker,
}: Props) => {
  const { main, second, failure } = actionsFor({ card });
  const onOpen = openFor({ card });
  const why = card.reason ?? card.detail;
  const sent = useAppStore((state) => state.sentToLead[card.id]);
  const leadSend = useMoveLeadSend({ sessionId, card });
  const [editNote, setEditNote] = useState<string | null>(null);
  const onEdit = async () => {
    if (sent === undefined) {
      return;
    }
    await useAppStore.getState().undoSendToLead({ key: card.id });
    if (useAppStore.getState().sentToLead[card.id] === undefined) {
      setEditNote(sent.note);
    }
  };
  if (sent !== undefined && sent.phase !== 'failed') {
    return (
      <div data-move={card.id} data-move-density={density} className="flex min-w-0 flex-col">
        <SentToLeadRow entry={sent} onEdit={() => void onEdit()} />
      </div>
    );
  }
  const sentLine =
    sent === undefined ? null : <SentToLeadRow entry={sent} onEdit={() => void onEdit()} />;
  const verbs = (
    <span className="flex shrink-0 items-center gap-2">
      {leadSend === null || sent !== undefined ? null : (
        <SendToLeadButton
          cardKey={card.id}
          send={leadSend}
          variant="secondary"
          editNote={editNote}
        />
      )}
      {main === null ? null : (
        <MoveVerb
          verb={main}
          cardId={card.id}
          cardTitle={card.title}
          variant={isPrimary ? 'primary' : 'secondary'}
          isMain
          onOpen={onOpen}
        />
      )}
      {second === null || density === 'row' ? null : (
        <MoveVerb
          verb={second}
          cardId={card.id}
          cardTitle={card.title}
          variant="secondary"
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
      </div>
    );
  }
  return (
    <div
      data-move={card.id}
      data-move-density="focus"
      data-move-primary={isPrimary ? '' : undefined}
      className="flex min-w-0 flex-col gap-2"
    >
      {kicker === null || kicker === '' ? null : (
        <span className="min-w-0 truncate text-meta text-muted-foreground">{kicker}</span>
      )}
      <span className="min-w-0 text-row text-foreground">{card.title}</span>
      {why === null || why === '' ? null : (
        <span className="min-w-0 text-ui text-muted-foreground">{why}</span>
      )}
      <MoveEvidenceChips sessionId={sessionId} evidence={card.evidence} />
      <div className="flex min-w-0 items-center gap-2">{verbs}</div>
      {failureLine}
      {sentLine}
    </div>
  );
};
