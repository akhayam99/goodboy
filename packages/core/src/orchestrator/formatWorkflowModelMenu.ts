import type { WorkflowTaskDifficulty, WorkflowTaskType } from '@goodboy/types';
import type { OrchestratorModelOption } from './types';

export const WORKFLOW_MODEL_MENU_BUDGET = 8000;

export const UNASSESSED_PROFILE_LABEL = 'unassessed';

const TASK_TYPE_CODES: Readonly<Record<WorkflowTaskType, string>> = {
  exploration: 'exp',
  planning: 'pln',
  implementation: 'imp',
  debugging: 'dbg',
  review: 'rev',
  testing: 'tst',
  writing: 'wrt',
  general: 'gen',
};

const DIFFICULTY_CODES: Readonly<Record<WorkflowTaskDifficulty, string>> = {
  light: 'lt',
  standard: 'st',
  heavy: 'hv',
  unknown: 'uk',
};

const LEGEND = [
  'Codes: exp=exploration, pln=planning, imp=implementation, dbg=debugging, rev=review, tst=testing, wrt=writing, gen=general; lt=light, st=standard, hv=heavy, uk=unknown.',
  `A model marked ${UNASSESSED_PROFILE_LABEL} has no reviewed routing profile, which is not a statement about how good it is.`,
  'Prices are published rates per million tokens, input then output, and are absent when this build has no rate for that provider.',
].join('\n');

type DetailLevel = 'full' | 'no_price' | 'identity';

type RowParams = {
  readonly option: OrchestratorModelOption;
  readonly detail: DetailLevel;
};

const effortList = ({ option }: { readonly option: OrchestratorModelOption }): string => {
  if (option.efforts.length === 0) {
    return 'no effort control';
  }
  return option.efforts.join(',');
};

const profileSegment = ({ option }: { readonly option: OrchestratorModelOption }): string => {
  if (option.taskTypes.length === 0) {
    return UNASSESSED_PROFILE_LABEL;
  }
  const tasks = option.taskTypes.map((taskType) => TASK_TYPE_CODES[taskType]).join(',');
  if (option.preferredDifficulty.length === 0) {
    return tasks;
  }
  const difficulties = option.preferredDifficulty
    .map((difficulty) => DIFFICULTY_CODES[difficulty])
    .join(',');
  return `${tasks}|${difficulties}`;
};

const contextSegment = ({ option }: { readonly option: OrchestratorModelOption }): string => {
  if (option.contextWindow <= 0) {
    return 'ctx unknown';
  }
  return `ctx ${Math.round(option.contextWindow / 1000)}k`;
};

const priceSegment = ({ option }: { readonly option: OrchestratorModelOption }): string => {
  const price = option.price;
  if (price === null) {
    return 'price unknown';
  }
  return `$${price.inputPerMtok}/$${price.outputPerMtok}`;
};

const menuRow = ({ option, detail }: RowParams): string => {
  const identity = `${option.provider}/${option.model} efforts ${effortList({ option })}`;
  if (detail === 'identity') {
    return identity;
  }
  const base = `${identity} ${profileSegment({ option })} ${contextSegment({ option })}`;
  if (detail === 'no_price') {
    return base;
  }
  return `${base} ${priceSegment({ option })}`;
};

type BodyParams = {
  readonly options: ReadonlyArray<OrchestratorModelOption>;
  readonly detail: DetailLevel;
};

const menuBody = ({ options, detail }: BodyParams): string => {
  const rows = options.map((option) => menuRow({ option, detail }));
  if (detail === 'identity') {
    return rows.join('\n');
  }
  return [LEGEND, ...rows].join('\n');
};

type Params = {
  readonly options: ReadonlyArray<OrchestratorModelOption>;
  readonly budget?: number;
};

export const formatWorkflowModelMenu = ({ options, budget }: Params): string => {
  const limit = budget ?? WORKFLOW_MODEL_MENU_BUDGET;
  const levels: ReadonlyArray<DetailLevel> = ['full', 'no_price', 'identity'];
  for (const detail of levels) {
    const rendered = menuBody({ options, detail });
    if (rendered.length <= limit) {
      return rendered;
    }
  }
  throw new Error(
    `workflow model menu identities need ${menuBody({ options, detail: 'identity' }).length} characters, over the ${limit} character budget: revise the routing protocol rather than hiding models`,
  );
};
