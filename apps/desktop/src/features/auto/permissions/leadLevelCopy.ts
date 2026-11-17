import type { AutoLevel } from '@goodboy/core/auto';
import { NAMES } from '../../../shared/utils/names';
import { runAutonomyOf } from '../../workflows/runAutonomy';

type WordParams = {
  readonly level: AutoLevel;
  readonly differ: number;
};

const LINES = {
  step: 'Stops before each step and each agent.',
  plan: 'Waits for your OK on the plan, then works to the end.',
  run: 'Works to the end. Pushes only when checks pass.',
} as const satisfies Record<AutoLevel, string>;

const levelLabelOf = ({ level }: Pick<WordParams, 'level'>): string =>
  runAutonomyOf({ autoRun: false, autonomy: level }).label;

const detailsOf = ({ differ }: Pick<WordParams, 'differ'>): string =>
  `${differ} ${differ === 1 ? 'detail' : 'details'}`;

export const LEAD_LEVEL_COPY = {
  chip: 'Stops',
  menu: 'Stops for your OK',
  custom: 'Custom',
  fineTuneRun: 'Fine-tune this run',
  fineTuneRunLine: `Opens the ${NAMES.lead}'s details beside the chat.`,
  fineTuneSettings: 'Fine-tune in Settings',
  fineTuneSettingsLine: `Opens the ${NAMES.lead}'s details for new runs.`,
  fineTuneDefault: `Fine-tune what the ${NAMES.lead} does alone`,
  fineTuneDefaultHint: 'Workflows follow the level only',
  drawerTitle: `${NAMES.lead} details`,
  drawerLine: 'For this run only.',
  label: levelLabelOf,
  line: ({ level }: Pick<WordParams, 'level'>): string => LINES[level],
  word: ({ level, differ }: WordParams): string =>
    differ === 0 ? levelLabelOf({ level }) : `Custom, ${detailsOf({ differ })}`,
  fact: ({ level, differ }: WordParams): string =>
    differ === 0
      ? runAutonomyOf({ autoRun: false, autonomy: level }).fact
      : `Custom stops, ${detailsOf({ differ })}`,
  help: ({ level, differ }: WordParams): string =>
    differ === 0
      ? LINES[level]
      : `Custom: ${detailsOf({ differ })} ${differ === 1 ? 'differs' : 'differ'} from ${levelLabelOf({ level })}.`,
  reset: ({ level }: Pick<WordParams, 'level'>): string => `Reset to ${levelLabelOf({ level })}`,
} as const;
