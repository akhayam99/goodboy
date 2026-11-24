import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { tintClasses } from '../../tint';
import { FactCardState } from './FactCardState';
import { toneOfFact } from './toneOfFact';
import type { FactState } from './types';

type Props = {
  readonly task: string;
  readonly state?: FactState;
  readonly stateGlyph: ReactNode;
};

export const FactCardTask = ({ task, state, stateGlyph }: Props) => (
  <div className="flex flex-col gap-2">
    <p className="line-clamp-4 text-ui text-foreground">{task}</p>
    {state === undefined ? null : (
      <FactCardState
        glyph={stateGlyph}
        words={
          <span className="inline-flex min-w-0 items-center gap-2">
            <span
              className={cn(
                state.tone === 'neutral'
                  ? 'text-muted-foreground'
                  : tintClasses(toneOfFact({ tone: state.tone })).text,
              )}
            >
              {state.words}
            </span>
            {state.note === undefined ? null : (
              <span className="text-faint-foreground">{state.note}</span>
            )}
          </span>
        }
      />
    )}
  </div>
);
