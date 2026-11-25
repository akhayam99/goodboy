import { useEffect, useRef } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from '@goodboy/ui/icons';
import { IconButton, ScrollFade, TruncatedText, cn, useEscapeLayer } from '@goodboy/ui';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { isFailedRequest } from '../../networkStatusWordOf';
import type { BrowserConsoleEntry } from '../../types';
import { requestFactsOf } from './requestFactsOf';

type StepParams = {
  readonly direction: -1 | 1;
};

type Props = {
  readonly entry: BrowserConsoleEntry;
  readonly isAlone: boolean;
  readonly canStepBack: boolean;
  readonly canStepOn: boolean;
  readonly onBack: () => void;
  readonly onStep: (params: StepParams) => void;
};

type Fact = {
  readonly label: string;
  readonly value: string;
};

export const BrowserRequestDetail = ({
  entry,
  isAlone,
  canStepBack,
  canStepOn,
  onBack,
  onStep,
}: Props) => {
  const root = useRef<HTMLDivElement | null>(null);
  const facts = requestFactsOf({ entry });
  const method = entry.method ?? 'GET';
  const isFailed = isFailedRequest({ status: entry.status });
  const rows: ReadonlyArray<Fact> = [
    { label: 'Method', value: method },
    { label: 'Path', value: entry.text },
    { label: 'Status', value: facts.status },
    { label: 'Type', value: entry.network?.type ?? 'other' },
    { label: 'Time', value: facts.time },
    ...(facts.size === null ? [] : [{ label: 'Size', value: facts.size }]),
    ...(entry.source === null ? [] : [{ label: 'Source', value: entry.source }]),
  ];

  useEscapeLayer(onBack);

  useEffect(() => {
    root.current?.focus();
  }, []);

  return (
    <div
      ref={root}
      role="region"
      aria-label="Request"
      tabIndex={-1}
      className={cn(
        'flex min-h-0 min-w-0 flex-col outline-none',
        isAlone ? 'flex-1' : 'w-1/2 shrink-0 border-l border-border-soft',
      )}
    >
      <div className="flex shrink-0 items-center gap-1 px-2">
        <IconButton size="xs" icon={ArrowLeft} label="Back to requests" onClick={onBack} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TruncatedText className={cn('text-code', isFailed ? 'text-danger' : 'text-foreground')}>
            {`${method} ${entry.text}`}
          </TruncatedText>
          <span className="truncate text-meta text-muted-foreground">
            {joinFacts({ facts: [facts.status, facts.time, facts.size] })}
          </span>
        </div>
        <IconButton
          size="xs"
          icon={ChevronUp}
          label="Previous request"
          disabled={!canStepBack}
          onClick={() => onStep({ direction: -1 })}
        />
        <IconButton
          size="xs"
          icon={ChevronDown}
          label="Next request"
          disabled={!canStepOn}
          onClick={() => onStep({ direction: 1 })}
        />
      </div>
      <ScrollFade className="min-h-0 flex-1" isPageScroller={false}>
        <dl className="flex flex-col gap-0.5 px-3 text-code">
          {rows.map((row) => (
            <div key={row.label} className="flex min-w-0 gap-3">
              <dt className="w-16 shrink-0 text-faint-foreground">{row.label}</dt>
              <dd className="min-w-0 break-words text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </ScrollFade>
    </div>
  );
};
