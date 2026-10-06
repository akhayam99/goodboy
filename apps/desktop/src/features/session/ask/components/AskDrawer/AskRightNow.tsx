import { ChevronDown } from 'lucide-react';
import { Eyebrow, WorkNode, type WorkNodeState } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import type { AskRightNowLine, AskRightNowTone } from '../../askRightNow';

type Props = {
  readonly lines: ReadonlyArray<AskRightNowLine>;
  readonly suggestions: ReadonlyArray<string>;
  readonly isFolded: boolean;
  readonly onUnfold: () => void;
  readonly onAsk: (question: string) => void;
};

const NODE_STATE: Readonly<Record<Exclude<AskRightNowTone, 'cost'>, WorkNodeState>> = {
  running: 'running',
  needs: 'question',
  failed: 'failed',
  done: 'done',
  idle: 'queued',
};

const CostIcon = CONCEPT_ICONS.budget;
const AskIcon = CONCEPT_ICONS.ask;

const foldSummary = (lines: ReadonlyArray<AskRightNowLine>): string =>
  lines
    .filter((line) => line.tone !== 'cost')
    .slice(0, 2)
    .map((line) => line.lead)
    .join(' · ');

export const AskRightNow = ({ lines, suggestions, isFolded, onUnfold, onAsk }: Props) => {
  if (isFolded) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={onUnfold}
        className="flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-meta text-muted-foreground motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <Eyebrow label="Right now" />
        <span className="min-w-0 flex-1 truncate text-left">{foldSummary(lines)}</span>
        <ChevronDown size={ICON_SIZE.row} aria-hidden />
      </button>
    );
  }
  return (
    <section aria-label="Right now" data-testid="ask-right-now" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Eyebrow label="Right now" />
        <span className="flex-1" />
        <span className="text-meta text-faint-foreground">instant, no model</span>
      </div>
      <ul className="flex flex-col gap-1">
        {lines.map((line) => (
          <li key={line.key} className="flex min-w-0 items-start gap-2 py-0.5 text-prose">
            {line.tone === 'cost' ? (
              <span className="flex h-5 shrink-0 items-center text-faint-foreground">
                <CostIcon size={ICON_SIZE.row} aria-hidden />
              </span>
            ) : (
              <WorkNode
                size="sm"
                state={NODE_STATE[line.tone]}
                mark={{ kind: 'dot' }}
                label={line.lead}
              />
            )}
            <span className="min-w-0 text-foreground">
              {line.key === 'comments' ? <strong>{line.lead}</strong> : line.lead}
              {line.detail === null ? null : (
                <span className="text-muted-foreground">{` · ${line.detail}`}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {suggestions.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <Eyebrow label="Try asking" />
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onAsk(suggestion)}
              className="flex min-h-8 items-center gap-2 rounded-md bg-background px-3 py-1 text-left text-prose text-foreground ring-1 ring-inset ring-border-soft motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <AskIcon
                size={ICON_SIZE.row}
                aria-hidden
                className="shrink-0 text-faint-foreground"
              />
              <span className="min-w-0 truncate">{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
