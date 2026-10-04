import {
  Circle,
  CircleAlert,
  CircleDot,
  CircleDotDashed,
  CircleMinus,
  CirclePlay,
  Dot,
  Square,
  Trash2,
} from 'lucide-react';
import type { ArtifactKind, ArtifactStatus } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { StatePresentation } from '../../shared/utils/statePresentation';
import { ARTIFACT_GENERATION_PRESENTATION, type ArtifactGeneration } from './artifactCollection';
import { ARTIFACT_KIND_MARKER_LABEL } from './artifactPresentation';
import type { PlanStateInputs } from '../plans/planStateInputs';

type ArtifactStateKey =
  | 'needs'
  | 'ready'
  | 'available'
  | 'running'
  | 'ran'
  | 'partly'
  | 'stopped'
  | 'replaced'
  | 'deleted'
  | 'new';

export type ArtifactGroup = 'needs' | 'ready' | 'running' | 'ran' | 'deleted';

export type ArtifactState = StatePresentation & {
  readonly key: ArtifactStateKey;
  readonly detail: string | null;
  readonly group: ArtifactGroup;
};

type Base = Omit<ArtifactState, 'detail'>;

const ARTIFACT_STATE_PRESENTATION = {
  needs: {
    key: 'needs',
    label: 'Needs you',
    reason: 'An agent asked a question, or the plan waits for your answer',
    tone: 'warning',
    icon: CircleAlert,
    group: 'needs',
  },
  ready: {
    key: 'ready',
    label: 'Ready to run',
    reason: 'Approved, waiting for Run plan',
    tone: 'info',
    icon: CirclePlay,
    group: 'ready',
  },
  running: {
    key: 'running',
    label: 'Running',
    reason: 'An agent is on it',
    tone: 'info',
    icon: CircleDot,
    group: 'running',
  },
  ran: {
    key: 'ran',
    label: 'Ran',
    reason: 'Every part is done',
    tone: 'success',
    icon: CONCEPT_ICONS.runDone,
    group: 'ran',
  },
  partly: {
    key: 'partly',
    label: 'Partly ran',
    reason: 'The run stopped before every part started',
    tone: 'warning',
    icon: CircleDotDashed,
    group: 'needs',
  },
  stopped: {
    key: 'stopped',
    label: 'Stopped',
    reason: 'The turn ended without producing it',
    tone: 'warning',
    icon: Square,
    group: 'needs',
  },
  available: {
    key: 'available',
    label: 'Ready',
    reason: 'Nothing waits on you, open it to read it',
    tone: 'neutral',
    icon: Circle,
    group: 'ready',
  },
  replaced: {
    key: 'replaced',
    label: 'Replaced',
    reason: 'A newer revision exists',
    tone: 'neutral',
    icon: CircleMinus,
    group: 'ran',
  },
  deleted: {
    key: 'deleted',
    label: 'Deleted',
    reason: 'In Recently deleted, restore any time',
    tone: 'neutral',
    icon: Trash2,
    group: 'deleted',
  },
  new: {
    key: 'new',
    label: 'New',
    reason: "You haven't opened it yet",
    tone: 'primary',
    icon: Dot,
    group: 'ready',
  },
} as const satisfies Record<ArtifactStateKey, Base>;

const withDetail = ({
  key,
  detail,
}: {
  readonly key: ArtifactStateKey;
  readonly detail: string | null;
}): ArtifactState => ({ ...ARTIFACT_STATE_PRESENTATION[key], detail });

const plural = ({ count, noun }: { readonly count: number; readonly noun: string }): string =>
  count === 1 ? `1 ${noun}` : `${count} ${noun}s`;

const partsDetail = ({ count }: { readonly count: number }): string | null =>
  count === 0 ? null : plural({ count, noun: 'part' });

type StoredParams = Readonly<{
  kind: ArtifactKind;
  status: ArtifactStatus;
  isNew: boolean;
  openQuestionCount: number;
}> &
  PlanStateInputs;

const ranState = ({
  progress,
  partCount,
  hasPartAgents,
}: Pick<StoredParams, 'progress' | 'partCount' | 'hasPartAgents'>): ArtifactState => {
  const done = withDetail({ key: 'ran', detail: partsDetail({ count: partCount }) });
  if (progress === null) {
    return done;
  }
  switch (progress.kind) {
    case 'running':
      return withDetail({
        key: 'running',
        detail: `part ${progress.part} of ${progress.total}`,
      });
    case 'question':
      return withDetail({ key: 'needs', detail: `part ${progress.part}` });
    case 'failed':
      return withDetail({ key: 'partly', detail: `part ${progress.part} failed` });
    case 'waiting':
      return hasPartAgents
        ? withDetail({ key: 'partly', detail: `${progress.done} of ${progress.total} parts` })
        : done;
    case 'notRun':
    case 'done':
      return done;
    default: {
      const exhaustive: never = progress;
      return exhaustive;
    }
  }
};

const planState = (params: StoredParams): ArtifactState => {
  if (params.status === 'consumed') {
    return ranState(params);
  }
  if (params.openQuestionCount > 0) {
    return withDetail({
      key: 'needs',
      detail: plural({ count: params.openQuestionCount, noun: 'question' }),
    });
  }
  return withDetail({ key: 'ready', detail: partsDetail({ count: params.partCount }) });
};

export const artifactStateOf = (params: StoredParams): ArtifactState | null => {
  if (params.status === 'discarded') {
    return withDetail({ key: 'deleted', detail: ARTIFACT_KIND_MARKER_LABEL[params.kind] });
  }
  if (params.status === 'superseded') {
    return withDetail({ key: 'replaced', detail: 'newer revision' });
  }
  if (params.kind === 'plan') {
    return planState(params);
  }
  return withDetail({
    key: params.isNew ? 'new' : 'available',
    detail: ARTIFACT_KIND_MARKER_LABEL[params.kind],
  });
};

export const generationStateOf = ({
  generation,
}: {
  readonly generation: ArtifactGeneration;
}): ArtifactState => {
  switch (generation.state) {
    case 'generating': {
      const total = generation.scouts.length;
      const done = generation.scouts.filter((scout) => scout.state === 'done').length;
      return withDetail({
        key: 'running',
        detail: total === 0 ? 'writing' : `${done} of ${total} scouts done`,
      });
    }
    case 'waiting':
      return withDetail({ key: 'needs', detail: 'waiting on your answer' });
    case 'unproduced':
      return withDetail({
        key: 'stopped',
        detail: ARTIFACT_GENERATION_PRESENTATION[generation.kind].unproduced.label,
      });
    default: {
      const exhaustive: never = generation.state;
      return exhaustive;
    }
  }
};
