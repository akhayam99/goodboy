import type { StartKind, StartShape } from '../../../../store/slices/sessionDraft/state';

export type StartFormKind = 'auto' | 'agent' | 'orchestrated' | 'preset';

export type StartSettingKey = 'where' | 'role' | 'model' | 'asks' | 'edits' | 'limit';

export const START_FORM_KINDS: ReadonlyArray<StartFormKind> = [
  'auto',
  'agent',
  'orchestrated',
  'preset',
];

const START_KIND_SETTINGS = {
  auto: ['where', 'model', 'asks', 'edits', 'limit'],
  agent: ['where', 'role', 'model', 'edits'],
  orchestrated: ['where', 'model', 'asks', 'edits', 'limit'],
  preset: ['where', 'model', 'asks', 'edits', 'limit'],
} as const satisfies Record<StartFormKind, ReadonlyArray<StartSettingKey>>;

const START_PICK_SETTINGS = [
  'where',
  'model',
  'asks',
  'edits',
  'limit',
] as const satisfies ReadonlyArray<StartSettingKey>;

type UsedParams = {
  readonly kind: StartFormKind | null;
};

export const startSettingsUsedBy = ({ kind }: UsedParams): ReadonlyArray<StartSettingKey> =>
  kind === null ? START_PICK_SETTINGS : START_KIND_SETTINGS[kind];

type ShapeParams = {
  readonly shape: StartShape;
};

const startFormKindOfShape = ({ shape }: ShapeParams): StartFormKind =>
  shape === 'autoAgent' ? 'auto' : shape;

type KindParams = {
  readonly kind: StartFormKind;
};

export const startShapeOfFormKind = ({ kind }: KindParams): StartShape =>
  kind === 'auto' ? 'autoAgent' : kind;

type DraftParams = {
  readonly startKind: StartKind | null;
  readonly startShape: StartShape | null;
};

export const startFormKindOfDraft = ({
  startKind,
  startShape,
}: DraftParams): StartFormKind | null =>
  (startKind === 'workflow' || startKind === 'agent') && startShape !== null
    ? startFormKindOfShape({ shape: startShape })
    : null;
