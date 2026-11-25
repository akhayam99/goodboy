import type { WorkflowId } from '@goodboy/types';
import type { StartKind, StartShape } from '../../../../store/slices/sessionDraft/state';

export type StartFormKind = 'lead' | 'preset' | 'agent';

export type StartSettingKey = 'where' | 'asks' | 'edits' | 'limit' | 'replies' | 'guidance';

export const START_SENTENCE_ORDER: ReadonlyArray<StartSettingKey> = [
  'asks',
  'edits',
  'limit',
  'replies',
  'guidance',
  'where',
];

const START_KIND_SETTINGS = {
  lead: ['where', 'asks', 'edits', 'limit', 'replies', 'guidance'],
  preset: ['where', 'asks', 'edits', 'limit', 'replies', 'guidance'],
  agent: ['where', 'edits', 'replies', 'guidance'],
} as const satisfies Record<StartFormKind, ReadonlyArray<StartSettingKey>>;

const START_PICK_SETTINGS = [
  'where',
  'asks',
  'edits',
  'limit',
  'replies',
  'guidance',
] as const satisfies ReadonlyArray<StartSettingKey>;

type UsedParams = {
  readonly kind: StartFormKind | null;
};

export const startSettingsUsedBy = ({ kind }: UsedParams): ReadonlyArray<StartSettingKey> =>
  kind === null ? START_PICK_SETTINGS : START_KIND_SETTINGS[kind];

type KindParams = {
  readonly kind: StartFormKind;
};

export const startShapeOfFormKind = ({ kind }: KindParams): StartShape =>
  kind === 'lead' ? 'autoAgent' : kind;

type DraftParams = {
  readonly startKind: StartKind | null;
  readonly startShape: StartShape | null;
  readonly workflowId: WorkflowId | null;
};

export const startFormKindOfDraft = ({
  startKind,
  startShape,
  workflowId,
}: DraftParams): StartFormKind | null => {
  if (startKind !== 'workflow' && startKind !== 'agent') {
    return null;
  }
  if (startShape === 'preset') {
    return workflowId === null ? null : 'preset';
  }
  return startShape === 'agent' ? 'agent' : null;
};
