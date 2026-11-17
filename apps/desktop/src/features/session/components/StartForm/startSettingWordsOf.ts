import { formatUsd } from '@goodboy/ui';
import type { WorkflowAutonomy } from '@goodboy/types';
import { MODE_COPY, type PickerMode } from '../../../permissions/modeCopy';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import type { StartSettingKey } from './startFormKinds';
import type { StartSettingWords } from './startSettingsOf';

const WORDS = START_KIND_COPY.words;

const STOPS_WORDS = {
  step: { lead: WORDS.stops, value: WORDS.stopsStep },
  plan: { lead: WORDS.stops, value: WORDS.stopsPlan },
  run: { lead: '', value: WORDS.stopsNever },
} as const satisfies Record<WorkflowAutonomy, StartSettingWords>;

type ProjectsParams = {
  readonly names: ReadonlyArray<string>;
};

const projectWordsOf = ({ names }: ProjectsParams): StartSettingWords => {
  const [first] = names;
  if (first === undefined) {
    return { lead: WORDS.projects, value: WORDS.projectsAuto };
  }
  if (names.length === 1) {
    return { lead: '', value: first };
  }
  return { lead: '', value: WORDS.projectCount({ count: names.length }) };
};

type Params = {
  readonly autonomy: WorkflowAutonomy | null;
  readonly editsMode: PickerMode;
  readonly limitUsd: number | null;
  readonly hasOwnGuidance: boolean;
  readonly projectNames: ReadonlyArray<string> | null;
};

export const startSettingWordsOf = ({
  autonomy,
  editsMode,
  limitUsd,
  hasOwnGuidance,
  projectNames,
}: Params): Readonly<Record<StartSettingKey, StartSettingWords | null>> => ({
  asks: autonomy === null ? null : STOPS_WORDS[autonomy],
  edits: { lead: START_KIND_COPY.edits.label, value: MODE_COPY[editsMode].label.toLowerCase() },
  limit: {
    lead: WORDS.limit,
    value: limitUsd === null ? WORDS.limitNone : formatUsd(limitUsd),
  },
  guidance: hasOwnGuidance
    ? { lead: START_KIND_COPY.guidance.label, value: WORDS.guidanceOwn }
    : null,
  where: projectNames === null ? null : projectWordsOf({ names: projectNames }),
});
