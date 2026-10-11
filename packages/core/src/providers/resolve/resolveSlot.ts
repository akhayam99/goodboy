import type {
  EffortLevel,
  ProviderId,
  RoleModelPreference,
  StepSize,
  TaskModelPreference,
} from '@goodboy/types';
import {
  policyDefaultProvider,
  providerStanding,
  unusableReason,
} from '../autoRouting/providerCandidates';
import { autoPassedOver, type AutoContext } from '../autoRouting/resolveAuto';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '../provider-preference';
import {
  resolveRoleChoice,
  resolveRoleRouting,
  roleModelChoices,
  type ResolvedRoleRouting,
} from '../role-models';
import { preferredTaskModel, traceTaskModel, type TaskModelTrace } from '../task-models';
import { mergeLayers, pinSourceOf } from './layers';
import type {
  LayerName,
  PinSource,
  Resolution,
  ResolveContext,
  ResolveLayers,
  ResolvePin,
  ResolvePins,
  ResolveSkip,
  ResolveSlot,
  ResolveSource,
  ResolveVia,
  SkippedChoice,
} from './types';

type Params = {
  readonly slot: ResolveSlot;
  readonly layers?: ResolveLayers;
  readonly context?: ResolveContext;
  readonly pins?: ResolvePins;
  readonly size?: StepSize | null;
};

const PIN_ORDER: ReadonlyArray<PinSource> = ['turn', 'agent', 'step', 'run'];

const EXPLICIT_PINS: ReadonlyArray<PinSource> = ['turn', 'agent'];

const PIN_EFFORT: EffortLevel = 'medium';

type Outcome = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly source: ResolveSource;
  readonly via: ResolveVia;
  readonly skipped: ReadonlyArray<ResolveSkip>;
  readonly isBlockedByHidden: boolean;
};

type ContextParams = {
  readonly context: ResolveContext;
  readonly layers: ResolveLayers;
};

const autoContextOf = ({ context, layers }: ContextParams): AutoContext => {
  const merged = mergeLayers(layers);
  const policy = context.policy === undefined ? merged.providerPool : context.policy;
  return {
    defaultProvider:
      merged.defaultProviderId ??
      context.defaultProvider ??
      DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
    ...(context.fallbackOrder != null && { fallbackOrder: context.fallbackOrder }),
    ...(context.connected != null && { connected: context.connected }),
    ...(context.atLimit != null && { atLimit: context.atLimit }),
    ...(policy != null && { policy }),
    ...(context.headroom != null && { headroom: context.headroom }),
    ...(context.hidden != null && { hidden: context.hidden }),
    ...(context.cliVersions != null && { cliVersions: context.cliVersions }),
    ...(context.learned != null && { learned: context.learned }),
    ...(context.isCursorMaxModeOn !== undefined && {
      isCursorMaxModeOn: context.isCursorMaxModeOn,
    }),
  };
};

type SkipsParams = {
  readonly source: ResolveSource;
  readonly choices: ReadonlyArray<SkippedChoice>;
};

const skipsOf = ({ source, choices }: SkipsParams): ReadonlyArray<ResolveSkip> =>
  choices.map((choice) => ({
    source,
    provider: choice.provider,
    model: choice.model,
    reason: choice.reason,
  }));

type PinParams = {
  readonly slot: ResolveSlot;
  readonly pin: ResolvePin;
  readonly auto: AutoContext;
  readonly isExplicit: boolean;
};

type PinEvaluation =
  | {
      readonly kind: 'usable';
      readonly provider: ProviderId;
      readonly model: string;
      readonly effort: EffortLevel | null;
    }
  | { readonly kind: 'skipped'; readonly skip: SkippedChoice };

const evaluatePin = ({ slot, pin, auto, isExplicit }: PinParams): PinEvaluation => {
  const resolved =
    slot.kind === 'role'
      ? resolveRoleChoice({ choice: pin, effort: pin.effort ?? PIN_EFFORT })
      : shapeOfTask(
          preferredTaskModel({
            task: slot.id,
            preference: pin,
            defaultProviderId: auto.defaultProvider,
          }),
        );
  if (resolved === null) {
    return {
      kind: 'skipped',
      skip: { provider: pin.providerId, model: pin.model, reason: 'unknown-model' },
    };
  }
  const reason = unusableReason({ provider: resolved.provider, context: auto });
  if (reason !== null && (reason === 'not-connected' || !isExplicit)) {
    return {
      kind: 'skipped',
      skip: { provider: resolved.provider, model: resolved.model, reason },
    };
  }
  return { kind: 'usable', ...resolved };
};

type Shape = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
};

const shapeOfTask = (preference: TaskModelPreference | null): Shape | null =>
  preference === null
    ? null
    : {
        provider: preference.providerId,
        model: preference.model,
        effort: preference.effort ?? null,
      };

type PinsParams = {
  readonly slot: ResolveSlot;
  readonly pins: ResolvePins;
  readonly auto: AutoContext;
};

type PinsResult = {
  readonly outcome: Outcome | null;
  readonly skipped: ReadonlyArray<ResolveSkip>;
};

const evaluatePins = ({ slot, pins, auto }: PinsParams): PinsResult => {
  const skipped: ResolveSkip[] = [];
  for (const source of PIN_ORDER) {
    const pin = pins[source];
    if (pin == null) {
      continue;
    }
    const evaluation = evaluatePin({ slot, pin, auto, isExplicit: EXPLICIT_PINS.includes(source) });
    if (evaluation.kind === 'skipped') {
      skipped.push({ source, ...evaluation.skip });
      continue;
    }
    return {
      outcome: {
        provider: evaluation.provider,
        model: evaluation.model,
        effort: evaluation.effort,
        source,
        via: 'pin',
        skipped,
        isBlockedByHidden: false,
      },
      skipped,
    };
  }
  return { outcome: null, skipped };
};

type AutoSkipsParams = {
  readonly slot: ResolveSlot;
  readonly auto: AutoContext;
  readonly provider: ProviderId;
  readonly model: string;
  readonly atLimit: ReadonlyArray<ProviderId>;
};

const autoSkips = ({
  slot,
  auto,
  provider,
  model,
  atLimit,
}: AutoSkipsParams): ReadonlyArray<ResolveSkip> => {
  const preferred = policyDefaultProvider(auto);
  const standing = providerStanding({ provider: preferred, context: auto });
  const providerReason =
    preferred !== provider &&
    (standing === 'off' || standing === 'not-connected' || standing === 'at-limit')
      ? [{ source: 'auto' as const, provider: preferred, model: null, reason: standing }]
      : [];
  const limitReasons = atLimit
    .filter((limited) => limited !== preferred || providerReason.length === 0)
    .map((limited) => ({
      source: 'auto' as const,
      provider: limited,
      model: null,
      reason: 'at-limit' as const,
    }));
  const passed = autoPassedOver({
    slot,
    pick: { provider, model, effort: null, step: 'curated' },
    context: auto,
  }).map((item): ResolveSkip => ({
    source: 'auto',
    provider,
    model: item.model,
    reason: item.reason,
  }));
  return [...providerReason, ...limitReasons, ...passed];
};

type RoleParams = {
  readonly slot: Extract<ResolveSlot, { kind: 'role' }>;
  readonly routing: ResolvedRoleRouting;
  readonly preference: RoleModelPreference | null;
  readonly source: LayerName | null;
  readonly auto: AutoContext;
};

const roleOutcome = ({ slot, routing, preference, source, auto }: RoleParams): Outcome => {
  const base = {
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
    isBlockedByHidden: routing.noAllowedModel === true,
  };
  const skippedPins =
    source === null ? [] : skipsOf({ source, choices: routing.skippedChoices ?? [] });
  if (routing.isOverride && source !== null && preference !== null) {
    const [first] = roleModelChoices({ preference });
    const firstResolved =
      first === undefined ? null : resolveRoleChoice({ choice: first, effort: preference.effort });
    const isFirst =
      firstResolved !== null &&
      firstResolved.provider === routing.provider &&
      firstResolved.model === routing.model;
    return {
      ...base,
      source,
      via: isFirst ? 'pin' : 'backup',
      skipped: skippedPins,
    };
  }
  const atLimit = routing.skippedAtLimit ?? [];
  return {
    ...base,
    source: 'auto',
    via: routing.autoStep ?? 'curated',
    skipped: [
      ...skippedPins,
      ...autoSkips({
        slot,
        auto,
        provider: routing.provider,
        model: routing.model,
        atLimit,
      }),
    ],
  };
};

type TaskParams = {
  readonly slot: Extract<ResolveSlot, { kind: 'task' }>;
  readonly trace: TaskModelTrace;
  readonly source: LayerName | null;
  readonly auto: AutoContext;
};

const taskOutcome = ({ slot, trace, source, auto }: TaskParams): Outcome => {
  const base = {
    provider: trace.model.providerId,
    model: trace.model.model,
    effort: trace.model.effort ?? null,
    isBlockedByHidden: false,
  };
  const skippedPins = source === null ? [] : skipsOf({ source, choices: trace.skipped });
  if (trace.via !== 'auto' && source !== null) {
    return { ...base, source, via: trace.via, skipped: skippedPins };
  }
  return {
    ...base,
    source: 'auto',
    via: trace.pick?.step ?? 'curated',
    skipped: [
      ...skippedPins,
      ...autoSkips({
        slot,
        auto,
        provider: base.provider,
        model: base.model,
        atLimit: trace.pick?.skippedAtLimit ?? [],
      }),
    ],
  };
};

export const resolveSlot = ({
  slot,
  layers = {},
  context = {},
  pins = {},
  size = null,
}: Params): Resolution => {
  const auto = autoContextOf({ context, layers });
  const merged = mergeLayers(layers);
  const source = pinSourceOf({ slot, layers });
  const fromPins = evaluatePins({ slot, pins, auto });
  const outcome = fromPins.outcome ?? layerOutcome({ slot, merged, source, auto, size });
  const skipped =
    fromPins.outcome === null ? [...fromPins.skipped, ...outcome.skipped] : outcome.skipped;
  return {
    slot,
    provider: outcome.provider,
    model: outcome.model,
    effort: outcome.effort,
    source: outcome.source,
    via: outcome.via,
    skipped,
    defaultProvider: policyDefaultProvider(auto),
    isBlockedByHidden: outcome.isBlockedByHidden,
  };
};

type LayerParams = {
  readonly slot: ResolveSlot;
  readonly merged: ReturnType<typeof mergeLayers>;
  readonly source: LayerName | null;
  readonly auto: AutoContext;
  readonly size: StepSize | null;
};

const layerOutcome = ({ slot, merged, source, auto, size }: LayerParams): Outcome => {
  if (slot.kind === 'role') {
    const routing = resolveRoleRouting({ role: slot.id, prefs: merged.roleModels, auto, size });
    return roleOutcome({
      slot,
      routing,
      preference: merged.roleModels?.[slot.id] ?? null,
      source,
      auto,
    });
  }
  const trace = traceTaskModel({ task: slot.id, preferences: merged.taskModels, auto });
  return taskOutcome({ slot, trace, source, auto });
};
