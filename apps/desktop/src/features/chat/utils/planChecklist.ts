import type { TranscriptItem } from './transcript-items';
import { toolKind } from './toolKind';

export type PlanItemState = 'done' | 'running' | 'todo';

export type PlanItem = {
  readonly text: string;
  readonly state: PlanItemState;
};

export type PlanChecklist = {
  readonly anchorKey: string;
  readonly items: ReadonlyArray<PlanItem>;
};

type Params = {
  readonly items: ReadonlyArray<TranscriptItem>;
};

type StateOfParams = {
  readonly status: unknown;
};

type TextOfParams = {
  readonly entry: object;
};

type ParseListParams = {
  readonly input: unknown;
};

const LIST_KEYS = ['todos', 'plan', 'items'] as const;
const TEXT_KEYS = ['content', 'step', 'text', 'description', 'title'] as const;

const stateOf = ({ status }: StateOfParams): PlanItemState => {
  if (status === 'completed' || status === 'done') {
    return 'done';
  }
  if (status === 'in_progress' || status === 'running' || status === 'active') {
    return 'running';
  }
  return 'todo';
};

const textOf = ({ entry }: TextOfParams): string | null => {
  for (const key of TEXT_KEYS) {
    const value: unknown = Reflect.get(entry, key);
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const parseList = ({ input }: ParseListParams): ReadonlyArray<PlanItem> | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  for (const key of LIST_KEYS) {
    const list: unknown = Reflect.get(input, key);
    if (!Array.isArray(list)) {
      continue;
    }
    return list.flatMap((entry: unknown): ReadonlyArray<PlanItem> => {
      if (typeof entry !== 'object' || entry === null) {
        return [];
      }
      const text = textOf({ entry });
      if (text === null) {
        return [];
      }
      return [{ text, state: stateOf({ status: Reflect.get(entry, 'status') }) }];
    });
  }
  return null;
};

export const planChecklist = ({ items }: Params): PlanChecklist | null => {
  let anchorKey: string | null = null;
  let latest: ReadonlyArray<PlanItem> | null = null;
  for (const item of items) {
    if (item.kind !== 'tool_call' || toolKind({ toolName: item.toolName }) !== 'plan') {
      continue;
    }
    const parsed = parseList({ input: item.input });
    if (parsed === null) {
      continue;
    }
    anchorKey = anchorKey ?? item.key;
    latest = parsed;
  }
  if (anchorKey === null || latest === null || latest.length === 0) {
    return null;
  }
  return { anchorKey, items: latest };
};
