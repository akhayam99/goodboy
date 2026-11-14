import type { Agent, SessionId } from '@goodboy/types';
import { Button, StatusDot, TruncatedText } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { useIsWorkOn } from '../../../shared/hooks/useIsWorkOn';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { autoTreeWordOf } from '../autoTreeWordOf';
import { AUTO_STATE_TONE } from './autoStateTone';
import type { AskBar } from './askBarOf';
import { useAnswerAsk } from './hooks/useAnswerAsk';
import { useAskPermissionRow } from './hooks/useAskPermissionRow';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
  readonly rootAgent: Agent;
  readonly bar: AskBar;
  readonly moreCount: number;
};

const TONE = AUTO_STATE_TONE.waitingOnYou;

export const AutoDockAsk = ({ sessionId, view, rootAgent, bar, moreCount }: Props) => {
  const isWork = useIsWorkOn();
  const rootTurn = useAppStore((state) => state.agentTurnState[rootAgent.id] ?? null);
  const word = autoTreeWordOf({ view, rootTurn, isWork });
  const model = useAnswerAsk({ sessionId });
  const rowText = useAskPermissionRow({ treeId: view.tree.id, rowKey: bar.rowKey });
  const isBusy = model.busyId === bar.askId;
  const error = model.failure?.askId === bar.askId ? model.failure.message : null;
  return (
    <section
      aria-label={bar.title}
      data-ask-bar={bar.kind}
      data-lead-state={word.state}
      className="flex min-w-0 flex-col gap-2 rounded-md border border-border-soft p-3 text-meta"
    >
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot tone={TONE} size="sm" />
        <TruncatedText className="min-w-0 truncate text-ui text-foreground" tooltip={bar.title}>
          {bar.title}
        </TruncatedText>
        {moreCount === 0 ? null : (
          <span className="shrink-0 text-muted-foreground">{`+${moreCount} more`}</span>
        )}
      </div>
      <p className="min-w-0 text-muted-foreground">
        {bar.code === null ? null : (
          <code className="text-code text-foreground">{`${bar.code} `}</code>
        )}
        {bar.detail}
      </p>
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          isBusy={isBusy}
          busyLabel="Sending"
          disabled={model.busyId !== null}
          onClick={() => void model.answer({ askId: bar.askId, answer: 'allow' })}
        >
          {bar.allowLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={model.busyId !== null}
          onClick={() => void model.answer({ askId: bar.askId, answer: 'decline' })}
        >
          {bar.declineLabel}
        </Button>
        <span className="min-w-0 flex-1" />
        {rowText === null ? null : (
          <span data-ask-row="" className="min-w-0 truncate text-right text-faint-foreground">
            {rowText}
          </span>
        )}
      </div>
      {error === null ? null : (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </section>
  );
};
