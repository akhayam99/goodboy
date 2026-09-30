import { useShallow } from 'zustand/react/shallow';
import { Eyebrow, WorkNode, cn } from '@goodboy/ui';
import type { ResolveVerdict, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { draftRoutingOf } from '../../draftRouting';
import { RECHECK_LABEL } from '../../reviewFlowCopy';
import { VERDICT_VIEW } from '../../reviewRemote';
import { REMOTE_TONE_CLASS } from './stateTone';

type Props = {
  readonly sessionId: SessionId;
  readonly verdict: ResolveVerdict;
  readonly isPushed: boolean;
};

const capitalized = ({ text }: { readonly text: string }): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

export const ThreadVerdictCard = ({ sessionId, verdict, isPushed }: Props) => {
  const routing = useAppStore(useShallow((s) => draftRoutingOf({ state: s, sessionId })));
  const view = VERDICT_VIEW[verdict.kind];
  const model =
    routing.effort === null || routing.effort === undefined
      ? modelLabel(routing.model)
      : `${modelLabel(routing.model)} · ${capitalized({ text: String(routing.effort) })}`;
  return (
    <section
      aria-label={RECHECK_LABEL.result}
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle px-4 py-3"
    >
      <Eyebrow label={RECHECK_LABEL.result} />
      <p className="flex min-w-0 items-center gap-2 text-label">
        <WorkNode state={view.node} label={view.word} mark={{ kind: 'dot' }} />
        <span className={cn('shrink-0', REMOTE_TONE_CLASS[view.tone])}>{view.word}</span>
      </p>
      <p className="min-w-0 text-secondary text-foreground">{verdict.evidence}</p>
      {isPushed && verdict.kind !== 'refix' && (
        <p className="text-secondary text-muted-foreground">{RECHECK_LABEL.alreadyPosted}</p>
      )}
      {verdict.kind === 'refix' && (
        <p className="text-secondary text-muted-foreground">{RECHECK_LABEL.runsOn({ model })}</p>
      )}
      <p className="text-secondary text-faint-foreground">
        {RECHECK_LABEL.checked}{' '}
        {formatRelativeAge({ fromIso: new Date(verdict.checkedAt).toISOString() })}
      </p>
    </section>
  );
};
