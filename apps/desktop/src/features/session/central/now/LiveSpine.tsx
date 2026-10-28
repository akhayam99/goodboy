import type { ReactNode } from 'react';
import type { Tone } from '@goodboy/ui';
import { agentKindPalette, type AgentKind } from '../../agent-kind';
import { LiveGlyph } from './LiveGlyph';
import { LiveRow } from './LiveRow';
import { LiveStateWord } from './LiveStateWord';

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

export const LiveSpine = ({ label, items }: Props) => (
  <ul aria-label={label} className="flex min-w-0 list-none flex-col">
    {items.map((item, index) => {
      const palette = agentKindPalette({ kind: item.kind });
      return (
        <li key={item.key} data-live-child="" className="flex min-w-0 flex-col">
          <LiveRow
            isChild
            lane={
              <span aria-hidden className="relative h-7 w-5 shrink-0">
                <svg
                  width="12"
                  height="14"
                  viewBox="0 0 12 14"
                  className="absolute left-2.5 top-0 text-border"
                >
                  <path d="M0.5 0 V8 Q0.5 13.5 6 13.5 H12" fill="none" stroke="currentColor" />
                </svg>
                {index === items.length - 1 ? null : (
                  <svg
                    width="1"
                    height="14"
                    viewBox="0 0 1 14"
                    preserveAspectRatio="none"
                    className="absolute bottom-0 left-2.5 h-1/2 text-border"
                  >
                    <path d="M0.5 0 V14" fill="none" stroke="currentColor" />
                  </svg>
                )}
              </span>
            }
            glyph={<LiveGlyph icon={palette.icon} colorClass={palette.fg} />}
            kindWord={item.noun}
            title={item.title}
            openLabel={item.openLabel}
            onOpen={item.onOpen}
            where={null}
            end={<LiveStateWord tone={item.tone} word={item.word} />}
            time={item.time}
          />
        </li>
      );
    })}
  </ul>
);
