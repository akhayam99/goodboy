import { Fragment, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { EmptyLine, Button, Collapsible, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSummarizerPending,
  useSummarizerRound,
  useSummarizerStatus,
} from '../../../../store';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { useNow } from '../../../../shared/hooks/useNow';
import { openSettings } from '../../../settings/openSettings';
import { ContextUpdateGlyph } from './ContextUpdateGlyph';
import {
  contextUpdateHint,
  contextUpdatePhase,
  roundChanges,
  roundModel,
  roundTrigger,
  roundUsage,
  type ContextUpdatePhase,
} from './contextUpdateCopy';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
};

const BUTTON_LABEL: Readonly<Record<ContextUpdatePhase, string>> = {
  idle: 'Update now',
  queued: 'Queued',
  running: 'Updating…',
  done: 'Updated',
  failed: 'Retry',
};

const TERM = 'text-meta text-faint-foreground';
const VALUE = 'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-label text-foreground';

export const ContextUpdates = ({ sessionId }: Props) => {
  const now = useNow(30_000);
  const { status, lastUpdate, lastAttempt, error } = useSummarizerStatus(sessionId);
  const round = useSummarizerRound(sessionId);
  const pending = useSummarizerPending(sessionId);
  const requestContextUpdate = useAppStore((state) => state.requestContextUpdate);
  const retrySummarizer = useAppStore((state) => state.retrySummarizer);
  const openContextDrawer = useAppStore((state) => state.openContextDrawer);
  const [isOpen, setIsOpen] = useState(false);
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const phase = contextUpdatePhase({ status, pending, round, requestedAt });
  const age = lastUpdate === null ? null : formatAge({ from: lastUpdate, now });
  const hasContext = lastUpdate !== null;
  const headline = {
    idle: age === null ? 'Not updated yet' : `Updated ${age}`,
    queued: 'Queued',
    running: 'Updating…',
    done: 'Updated just now',
    failed: "Couldn't update",
  }[phase];
  const changes = round === null ? [] : roundChanges({ round });

  const onUpdate = () => {
    setRequestedAt(new Date().toISOString());
    if (phase === 'failed' && lastAttempt !== null) {
      retrySummarizer(sessionId);
      return;
    }
    requestContextUpdate(sessionId);
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex-1 truncate text-label text-foreground">Context updates</span>
          <span className="inline-flex items-center gap-1 text-meta text-muted-foreground">
            <ContextUpdateGlyph phase={phase} placement="status" />
            {headline}
          </span>
        </span>
      }
    >
      {isOpen ? (
        <div className="flex flex-col gap-3 pt-1">
          {phase === 'failed' ? (
            <Notice
              tone="danger"
              placement="inline"
              title="Couldn't update"
              body={age === null ? null : `Agents keep working with the context from ${age}.`}
              detail={error}
            />
          ) : null}
          <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2">
            <dt className={TERM}>Last update</dt>
            <dd aria-label="Last update" className={VALUE}>
              <span>{age ?? 'Not yet'}</span>
              {round === null ? null : (
                <span className="text-muted-foreground">{`· ${roundTrigger({ round })}`}</span>
              )}
            </dd>
            <dt className={TERM}>Model</dt>
            <dd aria-label="Model" className={VALUE}>
              <span>{round === null ? 'Step summaries in Models' : roundModel({ round })}</span>
              <button
                type="button"
                onClick={() => openSettings({ scope: 'providers', section: 'summarizer' })}
                className="inline-flex items-center gap-0.5 text-meta text-muted-foreground hover:text-foreground"
              >
                Change model
                <ArrowUpRight size={ICON_SIZE.row} aria-hidden />
              </button>
            </dd>
            {round === null ? null : (
              <>
                <dt className={TERM}>Used</dt>
                <dd aria-label="Used" className={VALUE}>
                  {roundUsage({ round })}
                </dd>
                <dt className={TERM}>Changed</dt>
                <dd aria-label="Changed" className={VALUE}>
                  {changes.length === 0 ? (
                    <EmptyLine className="text-muted-foreground">Nothing changed</EmptyLine>
                  ) : (
                    <span className="min-w-0">
                      {changes.map((change, index) => (
                        <Fragment key={change.label}>
                          {index > 0 ? ', ' : null}
                          <button
                            type="button"
                            onClick={() => openContextDrawer({ sessionId, tab: change.tab })}
                            className="rounded-sm text-label text-foreground underline decoration-border underline-offset-2 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            {change.label}
                          </button>
                        </Fragment>
                      ))}
                    </span>
                  )}
                </dd>
              </>
            )}
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={
                phase === 'queued' || phase === 'running' || phase === 'done' || !hasContext
              }
              onClick={onUpdate}
            >
              <ContextUpdateGlyph phase={phase} placement="button" />
              {BUTTON_LABEL[phase]}
            </Button>
            <span className="text-meta text-muted-foreground">
              {contextUpdateHint({ phase, pendingTurns: pending.turns, hasContext })}
            </span>
          </div>
        </div>
      ) : null}
    </Collapsible>
  );
};
