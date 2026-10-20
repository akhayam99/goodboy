import type { KeyboardEvent } from 'react';
import { FactCard } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import type { PresetStepMark } from '../../../presetStepMarksOf';
import { presetMoreCardOf } from './presetMoreCardOf';
import { presetStepCardOf } from './presetStepCardOf';

const MAX_GLYPHS = 5;
const STEP_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);
const LIST_KEYS = new Set(['ArrowUp', 'ArrowDown']);
const STOP_CLASS =
  'inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

type Props = {
  readonly marks: ReadonlyArray<PresetStepMark>;
  readonly onExit: () => void;
};

type TargetParams = {
  readonly key: string;
  readonly current: number;
  readonly last: number;
};

const targetStop = ({ key, current, last }: TargetParams): number => {
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return last;
  }
  return Math.min(current + (key === 'ArrowRight' ? 1 : -1), last);
};

export const PresetStepMarks = ({ marks, onExit }: Props) => {
  const shown = marks.slice(0, MAX_GLYPHS);
  const hidden = marks.slice(MAX_GLYPHS);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (LIST_KEYS.has(event.key)) {
      onExit();
      return;
    }
    if (!STEP_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const stops = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-preset-glyph]')];
    const current = stops.findIndex((stop) => stop === document.activeElement);
    const target = targetStop({ key: event.key, current, last: stops.length - 1 });
    if (target < 0) {
      onExit();
      return;
    }
    stops[target]?.focus();
  };

  return (
    <span
      role="group"
      aria-label={`Steps: ${marks.map((mark) => mark.roleName).join(', ')}`}
      data-preset-step-marks=""
      onKeyDown={onKeyDown}
      className="flex items-center gap-1"
    >
      {shown.map((mark) => (
        <FactCard key={mark.key} side="bottom" card={presetStepCardOf({ mark })}>
          <span
            role="img"
            tabIndex={-1}
            data-preset-glyph=""
            data-step-role={mark.kind}
            aria-label={mark.label}
            className={STOP_CLASS}
          >
            <AgentKindChip kind={mark.kind} density="glyph" isDecorative />
          </span>
        </FactCard>
      ))}
      {hidden.length === 0 ? null : (
        <FactCard side="bottom" card={presetMoreCardOf({ hidden })}>
          <span
            role="img"
            tabIndex={-1}
            data-preset-glyph=""
            data-step-more=""
            aria-label={`${hidden.length} more steps: ${hidden.map((mark) => mark.roleName).join(', ')}`}
            className={STOP_CLASS}
          >
            {`+${hidden.length}`}
          </span>
        </FactCard>
      )}
    </span>
  );
};
