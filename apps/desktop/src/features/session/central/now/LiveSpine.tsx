import type { ReactNode } from 'react';
import { ROW_INTERACTIVE, StatusDot, cn, tintClasses, type Tone } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../agent-kind';

type LiveSpineItem = Readonly<{
  key: string;
  kind: AgentKind;
  noun: string;
  title: string;
  word: string;
  tone: Tone;
  time: ReactNode;
  openLabel: string;
  onOpen: () => void;
}>;

type Props = {
  readonly label: string;
  readonly items: ReadonlyArray<LiveSpineItem>;
};

type ToneParams = {
  readonly tone: Tone;
};

const wordClassOf = ({ tone }: ToneParams): string =>
  tone === 'neutral' ? 'text-muted-foreground' : tintClasses(tone).text;

export const LiveSpine = ({ label, items }: Props) => (
  <ul aria-label={label} className="flex min-w-0 list-none flex-col">
    {items.map((item, index) => (
      <li
        key={item.key}
        data-live-child=""
        className="flex min-h-7 min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1"
      >
        <span aria-hidden className="relative h-7 w-6 shrink-0">
          <svg
            width="12"
            height="14"
            viewBox="0 0 12 14"
            className="absolute left-3 top-0 text-border"
          >
            <path d="M0.5 0 V8 Q0.5 13.5 6 13.5 H12" fill="none" stroke="currentColor" />
          </svg>
          {index === items.length - 1 ? null : (
            <svg
              width="1"
              height="14"
              viewBox="0 0 1 14"
              preserveAspectRatio="none"
              className="absolute bottom-0 left-3 h-1/2 text-border"
            >
              <path d="M0.5 0 V14" fill="none" stroke="currentColor" />
            </svg>
          )}
        </span>
        <button
          type="button"
          aria-label={item.openLabel}
          onClick={item.onOpen}
          className={cn(
            'flex min-w-32 flex-1 items-center gap-2 self-stretch rounded-md px-1 text-left',
            ROW_INTERACTIVE,
          )}
        >
          <AgentKindChip kind={item.kind} density="glyph" isDecorative />
          <span className="shrink-0 text-ui text-foreground">{item.noun}</span>
          <span className="line-clamp-2 min-w-0 flex-1 break-words text-ui text-muted-foreground">
            {item.title === item.noun ? '' : item.title}
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-2">
          <span className="flex w-36 shrink-0 items-center gap-1 text-ui">
            <StatusDot tone={item.tone} size="sm" />
            <span className={cn('truncate', wordClassOf({ tone: item.tone }))}>{item.word}</span>
          </span>
          <span className="flex w-16 shrink-0 justify-end whitespace-nowrap tabular-nums">
            {item.time}
          </span>
        </span>
      </li>
    ))}
  </ul>
);
