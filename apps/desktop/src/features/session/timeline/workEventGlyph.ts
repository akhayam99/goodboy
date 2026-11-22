import type { WorkEvent } from '@goodboy/db';
import type { IconGlyph } from '@goodboy/ui/icons';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { workOutcomeOf } from '../../scripts/workOutcomeOf';

type Params = {
  readonly work: WorkEvent;
};

type WorkGlyph = {
  readonly icon: IconGlyph;
  readonly tone: Tone;
  readonly label: string;
};

export const workEventGlyph = ({ work }: Params): WorkGlyph => {
  const hasFailed = workOutcomeOf({ endedAt: work.endedAt, exitCode: work.exitCode }) === 'error';
  switch (work.kind) {
    case 'script':
      return {
        icon: CONCEPT_ICONS.scripts,
        tone: hasFailed ? 'danger' : CONCEPT_TONE.scripts,
        label: 'Script',
      };
    case 'command':
      return {
        icon: CONCEPT_ICONS.terminal,
        tone: hasFailed ? 'danger' : CONCEPT_TONE.terminal,
        label: 'Command',
      };
    case 'check-rerun':
      return {
        icon: CONCEPT_ICONS.checks,
        tone: hasFailed ? 'danger' : CONCEPT_TONE.checks,
        label: 'Check',
      };
    default: {
      const exhaustive: never = work.kind;
      return exhaustive;
    }
  }
};
