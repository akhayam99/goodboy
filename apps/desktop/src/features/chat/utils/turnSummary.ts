import type { TranscriptItem } from './transcript-items';
import { toolFilePath } from './toolFilePath';
import { toolKind, type ToolKind } from './toolKind';

export type TurnSummary = {
  readonly text: string;
  readonly errorCount: number;
  readonly title: string;
};

type NamedKind = Exclude<ToolKind, 'plan' | 'other'>;

type Clause = {
  readonly kind: NamedKind;
  uses: number;
  readonly files: Set<string>;
};

type Tally = {
  readonly named: Array<Clause>;
  otherUses: number;
  errorCount: number;
};

type Params = {
  readonly steps: ReadonlyArray<TranscriptItem>;
};

type ClauseParams = {
  readonly clause: Clause;
  readonly isNamingFiles: boolean;
};

type SentenceParams = {
  readonly named: ReadonlyArray<Clause>;
  readonly otherUses: number;
  readonly isNamingFiles: boolean;
};

type BaseNameParams = {
  readonly path: string;
};

type ClauseForParams = {
  readonly tally: Tally;
  readonly kind: NamedKind;
};

type AddStepParams = {
  readonly tally: Tally;
  readonly item: TranscriptItem;
};

type FileClauseParams = ClauseParams & {
  readonly verb: string;
};

type TimesClauseParams = {
  readonly base: string;
  readonly uses: number;
};

type StepsOfParams = {
  readonly clause: Clause;
};

const MAX_NAMED = 3;
const MAX_LENGTH = 64;
const MAX_FILE_NAME = 24;

const baseName = ({ path }: BaseNameParams): string => {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
};

const clauseFor = ({ tally, kind }: ClauseForParams): Clause => {
  const existing = tally.named.find((clause) => clause.kind === kind);
  if (existing !== undefined) {
    return existing;
  }
  const created: Clause = { kind, uses: 0, files: new Set<string>() };
  tally.named.push(created);
  return created;
};

const addStep = ({ tally, item }: AddStepParams) => {
  if (item.kind === 'file_edit') {
    clauseFor({ tally, kind: 'edit' }).files.add(item.path);
    return;
  }
  if (item.kind === 'skill_invocation') {
    tally.otherUses += 1;
    return;
  }
  if (item.kind !== 'tool_call') {
    return;
  }
  const kind = toolKind({ toolName: item.toolName });
  if (kind === 'plan') {
    return;
  }
  if (item.ended && item.isError) {
    tally.errorCount += 1;
  }
  if (kind === 'other') {
    tally.otherUses += 1;
    return;
  }
  const clause = clauseFor({ tally, kind });
  clause.uses += 1;
  const path = toolFilePath({ input: item.input });
  if (path !== null && (kind === 'read' || kind === 'edit')) {
    clause.files.add(path);
  }
};

const fileClause = ({ verb, clause, isNamingFiles }: FileClauseParams): string => {
  const count = clause.files.size > 0 ? clause.files.size : clause.uses;
  if (count > 1) {
    return `${verb} ${count} files`;
  }
  const [only] = [...clause.files];
  if (isNamingFiles && only !== undefined) {
    const name = baseName({ path: only });
    if (name.length <= MAX_FILE_NAME) {
      return `${verb} ${name}`;
    }
  }
  return `${verb} a file`;
};

const timesClause = ({ base, uses }: TimesClauseParams): string =>
  uses > 1 ? `${base} ${uses} times` : base;

const renderClause = ({ clause, isNamingFiles }: ClauseParams): string => {
  switch (clause.kind) {
    case 'command':
      return clause.uses > 1 ? `ran ${clause.uses} commands` : 'ran a command';
    case 'read':
      return fileClause({ verb: 'read', clause, isNamingFiles });
    case 'edit':
      return fileClause({ verb: 'edited', clause, isNamingFiles });
    case 'search':
      return timesClause({ base: 'searched the code', uses: clause.uses });
    case 'web':
      return timesClause({ base: 'searched the web', uses: clause.uses });
    default: {
      const exhaustive: never = clause.kind;
      return exhaustive;
    }
  }
};

const stepsOf = ({ clause }: StepsOfParams): number => Math.max(clause.uses, clause.files.size);

const sentence = ({ named, otherUses, isNamingFiles }: SentenceParams): string => {
  const clauses = named.map((clause) => renderClause({ clause, isNamingFiles }));
  if (otherUses > 0) {
    clauses.push(otherUses > 1 ? `used ${otherUses} tools` : 'used a tool');
  }
  const joined = clauses.join(', ');
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}`;
};

export const turnSummary = ({ steps }: Params): TurnSummary | null => {
  const tally: Tally = { named: [], otherUses: 0, errorCount: 0 };
  for (const item of steps) {
    addStep({ tally, item });
  }
  if (tally.named.length === 0 && tally.otherUses === 0) {
    return null;
  }
  const named = [...tally.named];
  let otherUses = tally.otherUses;
  while (named.length > MAX_NAMED) {
    otherUses += stepsOf({ clause: named.pop()! });
  }
  let isNamingFiles = true;
  let text = sentence({ named, otherUses, isNamingFiles });
  if (text.length > MAX_LENGTH) {
    isNamingFiles = false;
    text = sentence({ named, otherUses, isNamingFiles });
  }
  while (text.length > MAX_LENGTH && named.length > 0) {
    otherUses += stepsOf({ clause: named.pop()! });
    text = sentence({ named, otherUses, isNamingFiles });
  }
  const errors =
    tally.errorCount === 0
      ? ''
      : ` (${tally.errorCount} ${tally.errorCount === 1 ? 'error' : 'errors'})`;
  return { text, errorCount: tally.errorCount, title: `${text}${errors}` };
};
