import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from '@goodboy/ui/icons';
import {
  Button,
  IconButton,
  OptionalTooltip,
  ScrollFade,
  SegmentedTabs,
  TruncatedText,
  cn,
  useEscapeLayer,
  type SegmentedTabOption,
} from '@goodboy/ui';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { isFailedRequest } from '../../networkStatusWordOf';
import type { BrowserConsoleEntry } from '../../types';
import { NetworkBody } from './NetworkBody';
import { NetworkHeaders } from './NetworkHeaders';
import { NetworkTiming } from './NetworkTiming';
import { requestFactsOf } from './requestFactsOf';

type StepParams = {
  readonly direction: -1 | 1;
};

type Pane = 'headers' | 'payload' | 'response' | 'timing';

type Props = {
  readonly entry: BrowserConsoleEntry;
  readonly pageUrl: string;
  readonly isAlone: boolean;
  readonly canStepBack: boolean;
  readonly canStepOn: boolean;
  readonly agentName: string;
  readonly canSend: boolean;
  readonly onBack: () => void;
  readonly onStep: (params: StepParams) => void;
  readonly onSend: () => void;
};

const PANES: ReadonlyArray<SegmentedTabOption<Pane>> = [
  { value: 'headers', label: 'Headers' },
  { value: 'payload', label: 'Payload' },
  { value: 'response', label: 'Response' },
  { value: 'timing', label: 'Timing' },
];

export const NetworkDetail = ({
  entry,
  pageUrl,
  isAlone,
  canStepBack,
  canStepOn,
  agentName,
  canSend,
  onBack,
  onStep,
  onSend,
}: Props) => {
  const root = useRef<HTMLDivElement | null>(null);
  const [pane, setPane] = useState<Pane>('response');
  const facts = requestFactsOf({ entry });
  const method = entry.method ?? 'GET';
  const isFailed = isFailedRequest({ status: entry.status });

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
        'flex min-h-0 min-w-0 flex-col gap-1 outline-none',
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
        <OptionalTooltip content={`Send to ${agentName}`}>
          <Button
            variant="secondary"
            size="xs"
            aria-label={`Send request to ${agentName}`}
            disabled={!canSend}
            onClick={onSend}
          >
            Send request
          </Button>
        </OptionalTooltip>
      </div>
      <div className="flex shrink-0 px-2">
        <SegmentedTabs
          size="xs"
          ariaLabel="Request part"
          value={pane}
          onChange={setPane}
          options={PANES}
        />
      </div>
      <ScrollFade className="min-h-0 flex-1" isPageScroller={false}>
        <div className="flex min-w-0 flex-col px-3 pb-2">
          {pane === 'headers' ? <NetworkHeaders entry={entry} pageUrl={pageUrl} /> : null}
          {pane === 'payload' ? <NetworkBody entry={entry} part="request" /> : null}
          {pane === 'response' ? <NetworkBody entry={entry} part="response" /> : null}
          {pane === 'timing' ? <NetworkTiming entry={entry} /> : null}
        </div>
      </ScrollFade>
    </div>
  );
};
