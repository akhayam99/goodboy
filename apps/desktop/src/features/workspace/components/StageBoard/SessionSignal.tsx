import type { MouseEvent } from 'react';
import { CloudOff } from 'lucide-react';
import { cn, StateDot, Tooltip } from '@goodboy/ui';
import { PullRequestChip } from '../../../integrations/github/components/PullRequestChip';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { BoardSignal } from './boardSignalOf';
import { SignalWord } from './SignalWord';

const UNREACHABLE_LABEL = 'Could not reach GitHub, will retry';

type Props = {
  readonly signal: BoardSignal;
  readonly onOpenRequest?: (event: MouseEvent) => void;
};

type CountParams = {
  readonly count: number;
};

const questionLabel = ({ count }: CountParams): string =>
  count === 1 ? '1 open question' : `${count} open questions`;

const runningLabel = ({ count }: CountParams): string =>
  count === 1 ? '1 agent running' : `${count} agents running`;

const countWord = ({ count }: CountParams): string | null => (count > 1 ? String(count) : null);

export const SessionSignal = ({ signal, onOpenRequest }: Props) => {
  switch (signal.kind) {
    case 'question':
      return (
        <SignalWord
          label={questionLabel({ count: signal.count })}
          glyph={
            <CONCEPT_ICONS.questions size={ICON_SIZE.row} aria-hidden className="text-warning" />
          }
          word={countWord({ count: signal.count })}
        />
      );
    case 'checks-failed':
      return (
        <SignalWord
          label="Checks failing"
          glyph={
            <CONCEPT_ICONS.runFailed size={ICON_SIZE.row} aria-hidden className="text-danger" />
          }
          word="Checks"
        />
      );
    case 'running':
      return (
        <SignalWord
          label={runningLabel({ count: signal.count })}
          glyph={<StateDot state="running" label={runningLabel({ count: signal.count })} />}
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
          className="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {token}
        </button>
      );
    }
    case 'request-pending':
      return signal.fetchState === 'unknown' ? null : (
        <Tooltip content={UNREACHABLE_LABEL} side="top">
          <span
            role="img"
            aria-label={UNREACHABLE_LABEL}
            data-board-signal=""
            className="inline-flex text-faint-foreground"
          >
            <CloudOff size={ICON_SIZE.row} aria-hidden />
          </span>
        </Tooltip>
      );
    case 'none':
      return null;
    default: {
      const exhaustive: never = signal;
      return exhaustive;
    }
  }
};
