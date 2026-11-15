import { isRecord } from '@goodboy/types/helpers';
import { DEFAULT_AUTO_LEVEL, type AutoLevel } from './level';

export const LEAD_PERMISSION_VALUES = {
  approvePlan: ['ask', 'skip'],
  startReaders: ['ask', 'free'],
  startWriters: ['ask', 'afterPlan', 'free'],
  push: ['ask', 'whenChecksPass'],
  pullRequest: ['ask', 'allow'],
  dependencies: ['ask', 'allow'],
  protectedFiles: ['ask', 'allow'],
  addProject: ['ask', 'whenAllowed', 'allow'],
  closeWork: ['you', 'lead'],
} as const;

export type LeadPermissionKey = keyof typeof LEAD_PERMISSION_VALUES;

export type LeadPermissionValue<K extends LeadPermissionKey> =
  (typeof LEAD_PERMISSION_VALUES)[K][number];

export type LeadPermissionRows = { readonly [K in LeadPermissionKey]: LeadPermissionValue<K> };

export type StoredLeadPermissionRows = Partial<LeadPermissionRows>;

export const LEAD_PERMISSION_KEYS = [
  'approvePlan',
  'startReaders',
  'startWriters',
  'push',
  'pullRequest',
  'dependencies',
  'protectedFiles',
  'addProject',
  'closeWork',
] as const satisfies ReadonlyArray<LeadPermissionKey>;

export const LEAD_PERMISSION_PRESETS = {
  step: {
    approvePlan: 'ask',
    startReaders: 'ask',
    startWriters: 'ask',
    push: 'whenChecksPass',
    pullRequest: 'allow',
    dependencies: 'allow',
    protectedFiles: 'allow',
    addProject: 'ask',
    closeWork: 'you',
  },
  plan: {
    approvePlan: 'ask',
    startReaders: 'free',
    startWriters: 'afterPlan',
    push: 'whenChecksPass',
    pullRequest: 'allow',
    dependencies: 'allow',
    protectedFiles: 'allow',
    addProject: 'whenAllowed',
    closeWork: 'you',
  },
  run: {
    approvePlan: 'skip',
    startReaders: 'free',
    startWriters: 'free',
    push: 'whenChecksPass',
    pullRequest: 'allow',
    dependencies: 'allow',
    protectedFiles: 'allow',
    addProject: 'allow',
    closeWork: 'you',
  },
} as const satisfies Readonly<Record<AutoLevel, LeadPermissionRows>>;

export const LEAD_LOCKED_ROWS = [
  'forcePushAsks',
  'mergeIsYou',
  'agentsNeverPush',
  'leadNeverWrites',
] as const;

export type LeadLockedRow = (typeof LEAD_LOCKED_ROWS)[number];

export type LeadPermissionSource = 'lead' | 'default' | 'setting' | 'session' | 'workspace';

export type LeadPermissionNote = 'askWithoutPlan';

export type EffectiveLeadPermission<K extends LeadPermissionKey> = Readonly<{
  value: LeadPermissionValue<K>;
  source: LeadPermissionSource;
  note: LeadPermissionNote | null;
}>;

export type EffectiveLeadPermissionRows = {
  readonly [K in LeadPermissionKey]: EffectiveLeadPermission<K>;
};

export type LeadPermissions = Readonly<{
  rows: EffectiveLeadPermissionRows;
  preset: AutoLevel | 'custom';
  spendLimitUsd: number | null;
  locked: ReadonlyArray<LeadLockedRow>;
}>;

type StoredValueParams<K extends LeadPermissionKey> = {
  readonly key: K;
  readonly record: Readonly<Record<string, unknown>>;
};

const storedValueOf = <K extends LeadPermissionKey>({
  key,
  record,
}: StoredValueParams<K>): LeadPermissionValue<K> | undefined => {
  const values: ReadonlyArray<LeadPermissionValue<K>> = LEAD_PERMISSION_VALUES[key];
  return values.find((allowed) => allowed === record[key]);
};

type ParseParams = { readonly raw: string | null };

export const parseLeadPermissionRows = ({ raw }: ParseParams): StoredLeadPermissionRows => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw ?? 'null');
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed)) {
    return {};
  }
  const record = parsed;
  return {
    approvePlan: storedValueOf({ key: 'approvePlan', record }),
    startReaders: storedValueOf({ key: 'startReaders', record }),
    startWriters: storedValueOf({ key: 'startWriters', record }),
    push: storedValueOf({ key: 'push', record }),
    pullRequest: storedValueOf({ key: 'pullRequest', record }),
    dependencies: storedValueOf({ key: 'dependencies', record }),
    protectedFiles: storedValueOf({ key: 'protectedFiles', record }),
    addProject: storedValueOf({ key: 'addProject', record }),
    closeWork: storedValueOf({ key: 'closeWork', record }),
  };
};

export type LeadPermissionLayers = {
  readonly leadRows: StoredLeadPermissionRows;
  readonly defaultRows: StoredLeadPermissionRows;
  readonly sessionLevel: AutoLevel | null;
  readonly workspaceLevel: AutoLevel | null;
  readonly isPlanApprovalOff: boolean;
  readonly isWorkFlowOn: boolean;
};

export type LeadPermissionsParams = LeadPermissionLayers & {
  readonly spendLimitUsd: number | null;
};

type ResolveParams<K extends LeadPermissionKey> = {
  readonly key: K;
  readonly layers: LeadPermissionLayers;
};

const resolveRow = <K extends LeadPermissionKey>({
  key,
  layers,
}: ResolveParams<K>): EffectiveLeadPermission<K> => {
  const { leadRows, defaultRows, sessionLevel, workspaceLevel, isPlanApprovalOff, isWorkFlowOn } =
    layers;
  const lead: LeadPermissionRows[K] | undefined = leadRows[key];
  if (lead !== undefined) {
    return { value: lead, source: 'lead', note: null };
  }
  const workspaceDefault: LeadPermissionRows[K] | undefined = defaultRows[key];
  if (isWorkFlowOn && workspaceDefault !== undefined) {
    return { value: workspaceDefault, source: 'default', note: null };
  }
  if (key === 'approvePlan' && isPlanApprovalOff) {
    const skip: LeadPermissionRows[K] = LEAD_PERMISSION_PRESETS.run[key];
    return { value: skip, source: 'setting', note: null };
  }
  const level = sessionLevel ?? workspaceLevel ?? DEFAULT_AUTO_LEVEL;
  const preset: LeadPermissionRows[K] = LEAD_PERMISSION_PRESETS[level][key];
  return { value: preset, source: sessionLevel === null ? 'workspace' : 'session', note: null };
};

type LevelSourceParams = { readonly source: LeadPermissionSource };

const isLevelSource = ({ source }: LevelSourceParams): boolean =>
  source === 'session' || source === 'workspace';

type NormaliseParams = {
  readonly approvePlan: EffectiveLeadPermission<'approvePlan'>;
  readonly startWriters: EffectiveLeadPermission<'startWriters'>;
};

const normalisedWritersOf = ({
  approvePlan,
  startWriters,
}: NormaliseParams): EffectiveLeadPermission<'startWriters'> => {
  if (startWriters.value !== 'afterPlan' || approvePlan.value !== 'skip') {
    return startWriters;
  }
  if (approvePlan.source === 'setting' && isLevelSource({ source: startWriters.source })) {
    return { value: 'free', source: 'setting', note: null };
  }
  return { value: 'ask', source: startWriters.source, note: 'askWithoutPlan' };
};

type PresetParams = { readonly rows: EffectiveLeadPermissionRows };

const presetOf = ({ rows }: PresetParams): AutoLevel | 'custom' => {
  const levels: ReadonlyArray<AutoLevel> = ['step', 'plan', 'run'];
  const match = levels.find((level) =>
    LEAD_PERMISSION_KEYS.every((key) => LEAD_PERMISSION_PRESETS[level][key] === rows[key].value),
  );
  return match ?? 'custom';
};

export const leadPermissionsOf = ({
  spendLimitUsd,
  ...layers
}: LeadPermissionsParams): LeadPermissions => {
  const approvePlan = resolveRow({ key: 'approvePlan', layers });
  const rows: EffectiveLeadPermissionRows = {
    approvePlan,
    startReaders: resolveRow({ key: 'startReaders', layers }),
    startWriters: normalisedWritersOf({
      approvePlan,
      startWriters: resolveRow({ key: 'startWriters', layers }),
    }),
    push: resolveRow({ key: 'push', layers }),
    pullRequest: resolveRow({ key: 'pullRequest', layers }),
    dependencies: resolveRow({ key: 'dependencies', layers }),
    protectedFiles: resolveRow({ key: 'protectedFiles', layers }),
    addProject: resolveRow({ key: 'addProject', layers }),
    closeWork: resolveRow({ key: 'closeWork', layers }),
  };
  return { rows, preset: presetOf({ rows }), spendLimitUsd, locked: LEAD_LOCKED_ROWS };
};
