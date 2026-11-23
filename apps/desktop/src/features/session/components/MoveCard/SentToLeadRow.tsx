import { CircleAlert } from '@goodboy/ui/icons';
import { ICON_SIZE, StatusDot, TruncatedText } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { agentPlace, EMPTY_ARRAY, useAppStore } from '../../../../store';
import { usePoll } from '../../../../shared/lib/usePoll';
import { NAMES } from '../../../../shared/utils/names';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import type { SentToLead } from '../../../../store/slices/send-to-lead/state';
import { SEND_TO_LEAD_COPY } from '../../../work/sendToLead/sendToLeadCopy';
import {
  sentToLeadStatusOf,
  type SentToLeadStatus,
} from '../../../work/sendToLead/sentToLeadStatusOf';
import { startNewLead } from '../../../work/sendToLead/startNewLead';
import { SentRowVerb } from './SentRowVerb';

type Props = {
  readonly entry: SentToLead;
  readonly onEdit: () => void;
};

const POLL_MS = 5_000;

type SentenceParams = {
  readonly entry: SentToLead;
  readonly status: SentToLeadStatus;
};

const sentenceOf = ({ entry, status }: SentenceParams): string => {
  const title = entry.target.title;
  switch (status.kind) {
    case 'sending':
    case 'notRead':
      return `${SEND_TO_LEAD_COPY.hasIt({ title })} · ${SEND_TO_LEAD_COPY.notReadYet}`;
    case 'starting':
      return `${entry.branch === null ? SEND_TO_LEAD_COPY.newLead : SEND_TO_LEAD_COPY.newLeadOn({ branch: entry.branch })} · ${SEND_TO_LEAD_COPY.starting}`;
    case 'onIt':
      return SEND_TO_LEAD_COPY.isOnIt({ title });
    case 'stopped':
      return SEND_TO_LEAD_COPY.notDelivered;
    case 'failed':
      return status.failure === '' ? SEND_TO_LEAD_COPY.notSaved : status.failure;
    case 'undoFailed':
      return status.failure;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};

const LIVE: ReadonlySet<SentToLeadStatus['kind']> = new Set(['sending', 'notRead', 'starting']);

export const SentToLeadRow = ({ entry, onEdit }: Props) => {
  const rootAgentId = entry.target.rootAgentId;
  const leadSessionId: SessionId = entry.target.sessionId;
  const queue = useAppStore((state) =>
    rootAgentId === null ? EMPTY_ARRAY : (state.agentQueue[rootAgentId] ?? EMPTY_ARRAY),
  );
  const sessionViews = useAppStore((state) => state.autoTreeViews[leadSessionId] ?? EMPTY_ARRAY);
  const leads = useAppStore((state) => state.workLeads);
  const views = [...sessionViews, ...leads.map((lead) => lead.view)];
  const status = sentToLeadStatusOf({ entry, queue, views });
  usePoll({
    run: () => {
      const state = useAppStore.getState();
      const workspaceId = sessionById(state.sessions, entry.sessionId)?.workspaceId ?? null;
      if (workspaceId !== null) {
        void state.loadWorkLeads({ workspaceId });
      }
    },
    everyMs: POLL_MS,
    isEnabled: LIVE.has(status.kind),
  });
  const item = {
    key: entry.key,
    sessionId: entry.sessionId,
    text: entry.text,
    note: entry.note,
    threadId: entry.threadId,
    mountId: entry.mountId,
    branch: entry.branch,
  };
  const onOpen =
    rootAgentId === null
      ? null
      : () =>
          useAppStore
            .getState()
            .navigate({ to: agentPlace({ sessionId: leadSessionId, agentId: rootAgentId }) });
  const canTakeBack = status.kind === 'notRead' || status.kind === 'starting';
  const isProblem =
    status.kind === 'failed' || status.kind === 'stopped' || status.kind === 'undoFailed';
  return (
    <div data-sent-to-lead={status.kind} className="flex min-h-8 min-w-0 items-center gap-2">
      {isProblem ? (
        <CircleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0 text-danger" />
      ) : (
        <StatusDot
          tone={status.kind === 'onIt' ? 'success' : 'neutral'}
          size="sm"
          pulsing={status.kind === 'onIt'}
        />
      )}
      <button
        type="button"
        disabled={onOpen === null}
        onClick={onOpen ?? undefined}
        className="min-w-0 flex-1 text-left"
      >
        <TruncatedText
          role={isProblem ? 'alert' : undefined}
          className="min-w-0 text-ui text-foreground"
        >
          {sentenceOf({ entry, status })}
        </TruncatedText>
      </button>
      <span className="flex shrink-0 items-center gap-2">
        {status.kind === 'failed' ? (
          <SentRowVerb
            label={NAMES.retry}
            variant="secondary"
            onClick={() =>
              entry.isNew
                ? void startNewLead({ item })
                : void useAppStore.getState().retrySendToLead({ key: entry.key })
            }
          />
        ) : null}
        {status.kind === 'undoFailed' ? (
          <SentRowVerb
            label={NAMES.retry}
            variant="secondary"
            onClick={() => void useAppStore.getState().undoSendToLead({ key: entry.key })}
          />
        ) : null}
        {status.kind === 'stopped' ? (
          <SentRowVerb
            label={NAMES.startNewLead}
            variant="secondary"
            onClick={() => void startNewLead({ item })}
          />
        ) : null}
        {(status.kind === 'notRead' || status.kind === 'stopped') && !entry.isNew ? (
          <SentRowVerb label={SEND_TO_LEAD_COPY.edit} variant="quiet" onClick={onEdit} />
        ) : null}
        {canTakeBack ? (
          <SentRowVerb
            label={SEND_TO_LEAD_COPY.undo}
            variant="quiet"
            onClick={() => void useAppStore.getState().undoSendToLead({ key: entry.key })}
          />
        ) : null}
      </span>
    </div>
  );
};
