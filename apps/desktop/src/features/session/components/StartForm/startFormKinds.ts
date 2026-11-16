import type { StartKind, StartShape } from '../../../../store/slices/sessionDraft/state';

export type StartFormKind = 'lead' | 'preset' | 'agent';

export type StartSettingKey = 'where' | 'role' | 'asks' | 'edits' | 'limit' | 'guidance';

export const START_FORM_KINDS: ReadonlyArray<StartFormKind> = ['lead', 'preset', 'agent'];

const START_KIND_SETTINGS = {
  lead: ['where', 'asks', 'edits', 'limit', 'guidance'],
  preset: ['where', 'asks', 'edits', 'limit', 'guidance'],
  agent: ['where', 'role', 'edits', 'guidance'],
} as const satisfies Record<StartFormKind, ReadonlyArray<StartSettingKey>>;

const START_PICK_SETTINGS = [
  'where',
  'asks',
  'edits',
  'limit',
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
};

export const startFormKindOfDraft = ({
  startKind,
  startShape,
}: DraftParams): StartFormKind | null => {
  if (startKind !== 'workflow' && startKind !== 'agent') {
    return null;
  }
  if (startShape === 'preset' || startShape === 'agent') {
    return startShape;
  }
  return null;
};
