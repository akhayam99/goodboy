import type { MouseEvent } from 'react';
import { CloudOff } from 'lucide-react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { cn, ICON_SIZE, StateDot, Tooltip, FOCUS_RING, tintClasses } from '@goodboy/ui';
import { PullRequestChip } from '../../../integrations/github/components/PullRequestChip';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ATTENTION_REASON_META } from '../../../session/session-stage';
import type { BoardSignal } from './boardSignalOf';
import { SignalWord } from './SignalWord';

type Props = {
  readonly signal: BoardSignal;
  readonly onOpenRequest?: (event: MouseEvent) => void;
};

type CountParams = {
  readonly count: number;
};

const runningLabel = ({ count }: CountParams): string =>
  count === 1 ? '1 agent running' : `${count} agents running`;

const countWord = ({ count }: CountParams): string | null => (count > 1 ? String(count) : null);

export const SessionSignal = ({ signal, onOpenRequest }: Props) => {
  switch (signal.kind) {
    case 'attention': {
      const meta = ATTENTION_REASON_META[signal.reason];
      const Glyph = CONCEPT_ICONS[meta.icon];
      return (
        <SignalWord
          label={signal.label}
          glyph={<Glyph size={ICON_SIZE.row} aria-hidden className={tintClasses(meta.tone).text} />}
          word={signal.word}
        />
      );
    }
    case 'running':
      return (
        <SignalWord
          label={runningLabel({ count: signal.count })}
          glyph={<StateDot state="running" label={runningLabel({ count: signal.count })} isLive />}
          word={countWord({ count: signal.count })}
        />
      );
    case 'request': {
      const { request } = signal;
      if (request.state === 'none') {
        return null;
      }
      const token = (
        <PullRequestChip
          state={request.state}
          variant="compact"
          number={request.number}
          iconSize={ICON_SIZE.row}
          title={request.title}
          className={cn('tabular-nums', request.state === 'closed' && 'text-muted-foreground')}
        />
      );
      if (onOpenRequest === undefined) {
        return <span data-board-signal="">{token}</span>;
      }
      return (
        <button
          type="button"
          data-board-signal=""
          aria-label={`Open pull request ${request.number ?? ''}`.trim()}
          onClick={onOpenRequest}
          className={cn('inline-flex rounded-sm', FOCUS_RING)}
        >
          {token}
        </button>
      );
    }
    case 'request-pending': {
      if (signal.fetchState === 'unknown') {
        return null;
      }
      const unreachableLabel = `Could not reach ${REVIEW_SOURCE_LABEL[signal.host]}, will retry`;
      return (
        <Tooltip content={unreachableLabel} side="top">
          <span
            role="img"
            aria-label={unreachableLabel}
            data-board-signal=""
            className="inline-flex text-faint-foreground"
          >
            <CloudOff size={ICON_SIZE.row} aria-hidden />
          </span>
        </Tooltip>
      );
    }
    case 'none':
      return null;
    default: {
      const exhaustive: never = signal;
      return exhaustive;
    }
  }
};
