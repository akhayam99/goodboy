import type { ReactNode } from 'react';
import type { ProviderId } from '@goodboy/types';
import { formatTokens, formatUsd, type Fact, type FactCardSpec } from '@goodboy/ui';
import { NAMES } from '../../shared/utils/names';
import { formatAge } from '../../shared/utils/time/formatAge';
import { formatClock } from '../../shared/utils/time/formatClock';
import type { TokenTotals } from '../session/timeline/agentTokenTotals';
import type { AgentModels, RanModel } from '../session/timeline/ranModels';
import type { RowPhase } from './rowState';
import type { WorkTime } from './workTime';

type FactModel = NonNullable<FactCardSpec['models']>[number];
type FactEffort = NonNullable<FactModel['effort']>;
type FactState = NonNullable<FactCardSpec['state']>;

type MarkParams = {
  readonly provider: ProviderId | null;
};

export type RoleCardParams = {
  readonly glyph: ReactNode;
  readonly stateGlyph: ReactNode;
  readonly markOf: (params: MarkParams) => ReactNode;
  readonly kindWord: string;
  readonly position: string;
  readonly task: string;
  readonly phase: RowPhase;
  readonly time: WorkTime | null | undefined;
  readonly askedAt: string | null;
  readonly nowMs: number;
  readonly models: AgentModels;
  readonly isEffortObserved: boolean;
  readonly startedAt: string | null;
  readonly tokens: TokenTotals | null;
  readonly costUsd: number;
  readonly footnote: string | null;
};

type EffortParams = {
  readonly model: RanModel;
  readonly isEffortObserved: boolean;
};

type StateParams = Pick<RoleCardParams, 'phase' | 'time' | 'askedAt' | 'nowMs'>;

type AskedParams = Pick<RoleCardParams, 'askedAt' | 'nowMs'>;

const effortOf = ({ model, isEffortObserved }: EffortParams): FactEffort | undefined => {
  if (model.effort === null) {
    return undefined;
  }
  const levels = model.effortLevels ?? [];
  const step = model.effortLevel == null ? 0 : levels.indexOf(model.effortLevel) + 1;
  const isPlanned = !isEffortObserved && model.endReason === null;
  return {
    word: model.effort,
    step,
    steps: step === 0 ? 0 : levels.length,
    ...(isPlanned ? { isPlanned } : {}),
  };
};

const askedNote = ({ askedAt, nowMs }: AskedParams): string | undefined => {
  if (askedAt === null) {
    return undefined;
  }
  const age = formatAge({ from: askedAt, now: nowMs });
  return age === '' ? undefined : `asked ${age}`;
};

const stateOf = ({ phase, time, askedAt, nowMs }: StateParams): FactState => {
  const headline = time?.headline;
  switch (phase) {
    case 'queued':
      return { tone: 'neutral', words: 'Queued', ...(time == null ? {} : { note: time.label }) };
    case 'running':
      return {
        tone: 'info',
        words: 'Working',
        isRunning: true,
        ...(headline === undefined ? {} : { note: headline }),
      };
    case 'waiting': {
      const note = askedNote({ askedAt, nowMs });
      return { tone: 'warning', words: NAMES.needsYou, ...(note === undefined ? {} : { note }) };
    }
    case 'failed':
      return {
        tone: 'danger',
        words: 'Failed',
        ...(headline === undefined ? {} : { note: `after ${headline}` }),
      };
    case 'done':
      return {
        tone: 'neutral',
        words: 'Done',
        ...(headline === undefined ? {} : { note: `in ${headline}` }),
      };
    case 'closed':
      return { tone: 'neutral', words: 'Closed' };
    case 'skipped':
      return { tone: 'neutral', words: 'Skipped' };
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
};

export const roleCardSpec = ({
  glyph,
  stateGlyph,
  markOf,
  kindWord,
  position,
  task,
  phase,
  time,
  askedAt,
  nowMs,
  models,
  isEffortObserved,
  startedAt,
  tokens,
  costUsd,
  footnote,
}: RoleCardParams): FactCardSpec => {
  const facts: Array<Fact> = [];
  if (startedAt !== null) {
    facts.push({ label: 'Started', value: formatClock({ at: startedAt }) });
  }
  if (tokens !== null) {
    facts.push({
      label: 'Tokens',
      value: `${formatTokens(tokens.input)} in, ${formatTokens(tokens.output)} out`,
      note: `${formatTokens(tokens.cached)} cached`,
    });
  }
  if (costUsd > 0) {
    facts.push({ label: 'Cost', value: formatUsd(costUsd) });
  }
  return {
    glyph,
    title: kindWord,
    sub: position,
    task,
    state: stateOf({ phase, time, askedAt, nowMs }),
    stateGlyph,
    models: models.models.map((model) => {
      const effort = effortOf({ model, isEffortObserved });
      return {
        key: model.key,
        name: model.name,
        mark: markOf({ provider: model.provider }),
        ...(effort === undefined ? {} : { effort }),
        ...(models.isPlanned ? { isPlanned: true } : {}),
      };
    }),
    facts,
    ...(footnote === null ? {} : { footnote }),
  };
};
