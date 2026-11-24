import { PROVIDER_IDS, type ProviderId, type RoleModelPreference } from '@goodboy/types';
import { autoChildProviders, isAutoOwnProvider } from '../../auto/providers';
import { parseAutoDelegationRole } from '../../auto/roles';
import { normalizeAgentRole } from '../../roles';
import type { AutoContext, AutoSlot } from '../autoRouting/autoTypes';
import { RUNGS, type Rung } from '../autoRouting/effortLadder';
import { providerStepPick, type StepPick } from '../autoRouting/modelForStep';
import { providerCandidates, providerStanding } from '../autoRouting/providerCandidates';
import { lowestRungOf, rungForStep } from '../autoRouting/slotRungs';
import { catalogModelForId } from '../catalogModelForId';
import { cliGate } from '../cliGate';
import { getProviderModelPrice } from '../model-price';
import { resolveRoleChoice, roleModelChoices } from '../role-models';
import type { CandidateCause } from './candidateCauses';
import { modelFamily } from './modelFamily';
import type {
  Candidate,
  CandidateExclusion,
  CandidateInputs,
  CandidateList,
  CandidateNeed,
} from './types';

type ProviderParams = {
  readonly provider: ProviderId;
  readonly inputs: CandidateInputs;
  readonly need: CandidateNeed;
};

type UniverseParams = {
  readonly inputs: CandidateInputs;
};

const universeOf = ({ inputs }: UniverseParams): ReadonlyArray<ProviderId> =>
  providerCandidates({ ...inputs, atLimit: null, headroom: null, connected: null });

type IsInParams = {
  readonly list: ReadonlyArray<ProviderId> | null | undefined;
  readonly provider: ProviderId;
};

const isIn = ({ list, provider }: IsInParams): boolean => list != null && list.includes(provider);

const roleProviders = ({
  need,
}: Pick<ProviderParams, 'need'>): ReadonlyArray<ProviderId> | null => {
  const role = parseAutoDelegationRole({ role: need.role });
  return need.scope === 'helper' && role !== null ? autoChildProviders({ role }) : null;
};

const standingCause = ({ provider, inputs, need }: ProviderParams): CandidateCause | null => {
  const standing = providerStanding({ provider, context: inputs });
  if (standing === 'not-connected' || standing === 'off' || standing === 'at-limit') {
    return standing;
  }
  if (isIn({ list: inputs.coolingDown, provider })) {
    return 'cooldown';
  }
  if (isIn({ list: inputs.breakerOpen, provider })) {
    return 'breaker';
  }
  if (isIn({ list: inputs.budgetBlocked, provider })) {
    return 'budget';
  }
  if (inputs.runProviders != null && !inputs.runProviders.includes(provider)) {
    return 'outside-run';
  }
  if (isIn({ list: need.failedStarts, provider })) {
    return 'failed-start';
  }
  if (need.scope === 'helper' && !isAutoOwnProvider({ provider })) {
    return 'not-for-helpers';
  }
  const allowed = roleProviders({ need });
  return allowed !== null && !allowed.includes(provider) ? 'writer' : null;
};

type CausesParams = {
  readonly universe: ReadonlyArray<ProviderId>;
  readonly inputs: CandidateInputs;
  readonly need: CandidateNeed;
};

type CauseMap = ReadonlyMap<ProviderId, CandidateCause | null>;

const providerCauses = ({ universe, inputs, need }: CausesParams): CauseMap =>
  new Map<ProviderId, CandidateCause | null>(
    PROVIDER_IDS.map((provider) => [
      provider,
      universe.includes(provider) ? standingCause({ provider, inputs, need }) : 'off',
    ]),
  );

type BackupParams = {
  readonly universe: ReadonlyArray<ProviderId>;
  readonly inputs: CandidateInputs;
  readonly causes: CauseMap;
  readonly isRunnable: (params: Pick<ProviderParams, 'provider'>) => boolean;
};

const withBackupIdle = ({ universe, inputs, causes, isRunnable }: BackupParams): CauseMap => {
  const canOnWork = (inputs.policy ?? []).some(
    (entry) =>
      entry.state === 'on' && causes.get(entry.id) === null && isRunnable({ provider: entry.id }),
  );
  if (!canOnWork) {
    return causes;
  }
  const idle: CandidateCause = 'backup-idle';
  return new Map(
    [...causes.entries()].map(([provider, cause]) => [
      provider,
      cause === null &&
      universe.includes(provider) &&
      providerStanding({ provider, context: inputs }) === 'backup'
        ? idle
        : cause,
    ]),
  );
};

type PickParams = {
  readonly provider: ProviderId;
  readonly need: CandidateNeed;
  readonly rung: Rung;
  readonly context: AutoContext;
};

const pickAt = ({ provider, need, rung, context }: PickParams): StepPick | null => {
  const slot: AutoSlot = { kind: 'role', id: need.role };
  return providerStepPick({
    provider,
    slot,
    rung,
    context,
    isHeavy: need.size === 'large',
    isCeilingKept: true,
  });
};

const lighterRungOf = ({ need, rung }: Pick<PickParams, 'need' | 'rung'>): Rung | null => {
  const at = RUNGS.indexOf(rung);
  const lowest = RUNGS.indexOf(lowestRungOf({ slot: { kind: 'role', id: need.role } }));
  return at - 1 >= lowest ? (RUNGS[at - 1] ?? null) : null;
};

const modelCause = ({ provider, need, rung, context }: PickParams): CandidateCause => {
  if (pickAt({ provider, need, rung, context: { ...context, hidden: null } }) !== null) {
    return 'hidden';
  }
  if (
    pickAt({ provider, need, rung, context: { ...context, cliVersions: {}, learned: [] } }) !== null
  ) {
    return 'cli-too-old';
  }
  return 'no-model';
};

type RowParams = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: Candidate['effort'];
  readonly rung: Rung | null;
  readonly isLighter: boolean;
  readonly order: number;
  readonly inputs: CandidateInputs;
  readonly cause: CandidateCause | null;
};

const candidateRowOf = ({
  provider,
  model,
  effort,
  rung,
  isLighter,
  order,
  inputs,
  cause,
}: RowParams): Candidate => {
  const key = catalogModelForId({ provider, modelId: model })?.key ?? null;
  return {
    provider,
    model,
    effort,
    rung,
    isLighter,
    order,
    family: modelFamily({ provider, model }),
    room: inputs.room?.[provider] ?? null,
    load: inputs.load?.[provider] ?? 0,
    price: key === null ? null : getProviderModelPrice({ provider, model: key }),
    cause,
  };
};

type ProviderRowsParams = ProviderParams & {
  readonly order: number;
  readonly cause: CandidateCause | null;
};

type ProviderRows = Readonly<{
  rows: ReadonlyArray<Candidate>;
  exclusion: CandidateExclusion | null;
}>;

const providerRows = ({
  provider,
  inputs,
  need,
  order,
  cause,
}: ProviderRowsParams): ProviderRows => {
  const rung = rungForStep({ slot: need.role, size: need.size });
  const main = pickAt({ provider, need, rung, context: inputs });
  if (main === null) {
    return {
      rows: [],
      exclusion: {
        provider,
        cause: cause ?? modelCause({ provider, need, rung, context: inputs }),
      },
    };
  }
  const lighterRung = lighterRungOf({ need, rung });
  const lighter =
    lighterRung === null ? null : pickAt({ provider, need, rung: lighterRung, context: inputs });
  const picks = [main, ...(lighter === null ? [] : [lighter])].filter(
    (pick, index, all) =>
      all.findIndex((other) => other.model === pick.model && other.effort === pick.effort) ===
      index,
  );
  return {
    rows: picks.map((pick) =>
      candidateRowOf({
        provider,
        model: pick.model,
        effort: pick.effort,
        rung: pick.rung,
        isLighter: RUNGS.indexOf(pick.rung) < RUNGS.indexOf(rung),
        order,
        inputs,
        cause,
      }),
    ),
    exclusion: null,
  };
};

type PinParams = {
  readonly preference: RoleModelPreference;
  readonly universe: ReadonlyArray<ProviderId>;
  readonly causes: CauseMap;
  readonly inputs: CandidateInputs;
};

type PinCauseParams = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly inputs: CandidateInputs;
};

const pinCliCause = ({ provider, model, inputs }: PinCauseParams): CandidateCause | null => {
  const key = catalogModelForId({ provider, modelId: model })?.key ?? null;
  if (key === null) {
    return null;
  }
  const gate = cliGate({
    provider,
    modelKey: key,
    installedVersion: inputs.cliVersions?.[provider] ?? null,
    learned: inputs.learned ?? [],
  });
  return gate === null ? null : 'cli-too-old';
};

const pinnedRows = ({
  preference,
  universe,
  causes,
  inputs,
}: PinParams): ReadonlyArray<Candidate> =>
  roleModelChoices({ preference }).flatMap((choice) => {
    const resolved = resolveRoleChoice({ choice, effort: preference.effort });
    if (resolved === null) {
      return [];
    }
    const at = universe.indexOf(resolved.provider);
    return [
      candidateRowOf({
        provider: resolved.provider,
        model: resolved.model,
        effort: resolved.effort,
        rung: null,
        isLighter: false,
        order: at === -1 ? universe.length + 1 : at + 1,
        inputs,
        cause:
          causes.get(resolved.provider) ??
          pinCliCause({ provider: resolved.provider, model: resolved.model, inputs }),
      }),
    ];
  });

type FamilyParams = {
  readonly rows: ReadonlyArray<Candidate>;
  readonly writerFamily: CandidateNeed['writerFamily'];
};

type FamilyRows = Readonly<{
  rows: ReadonlyArray<Candidate>;
  isSameFamilyKept: boolean;
}>;

const withFamilyGuard = ({ rows, writerFamily }: FamilyParams): FamilyRows => {
  if (writerFamily == null) {
    return { rows, isSameFamilyKept: false };
  }
  const sameFamily: CandidateCause = 'same-family';
  const guarded = rows.map((row) =>
    row.cause === null && row.family === writerFamily ? { ...row, cause: sameFamily } : row,
  );
  const wasValid = rows.some((row) => row.cause === null);
  const hasValid = guarded.some((row) => row.cause === null);
  if (wasValid && !hasValid) {
    return { rows, isSameFamilyKept: true };
  }
  return { rows: guarded, isSameFamilyKept: false };
};

type Params = {
  readonly inputs: CandidateInputs;
  readonly need: CandidateNeed;
};

export const buildCandidates = ({ inputs, need }: Params): CandidateList => {
  const universe = universeOf({ inputs });
  const standing = providerCauses({ universe, inputs, need });
  const preference = inputs.rolePins?.[normalizeAgentRole({ role: need.role })] ?? null;
  const standingPins =
    preference === null ? [] : pinnedRows({ preference, universe, causes: standing, inputs });
  const rung = rungForStep({ slot: need.role, size: need.size });
  const causes = withBackupIdle({
    universe,
    inputs,
    causes: standing,
    isRunnable: ({ provider }) =>
      standingPins.some((row) => row.provider === provider && row.cause === null) ||
      pickAt({ provider, need, rung, context: inputs }) !== null,
  });
  const pinned = preference === null ? [] : pinnedRows({ preference, universe, causes, inputs });
  const pinnedFamily = withFamilyGuard({ rows: pinned, writerFamily: need.writerFamily });
  if (pinnedFamily.rows.some((row) => row.cause === null)) {
    return {
      rule: inputs.rule,
      rows: pinnedFamily.rows,
      excluded: [],
      isPinned: true,
      isSameFamilyKept: pinnedFamily.isSameFamilyKept,
    };
  }
  const built = universe.map((provider, index) =>
    providerRows({ provider, inputs, need, order: index + 1, cause: causes.get(provider) ?? null }),
  );
  const outside = PROVIDER_IDS.filter((provider) => !universe.includes(provider)).map(
    (provider): CandidateExclusion => ({ provider, cause: 'off' }),
  );
  const family = withFamilyGuard({
    rows: built.flatMap((entry) => entry.rows),
    writerFamily: need.writerFamily,
  });
  return {
    rule: inputs.rule,
    rows: family.rows,
    excluded: [
      ...built.flatMap((entry) => (entry.exclusion === null ? [] : [entry.exclusion])),
      ...outside,
    ],
    isPinned: false,
    isSameFamilyKept: family.isSameFamilyKept,
  };
};
