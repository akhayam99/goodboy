export type SourceKind = 'ts' | 'rust' | 'config' | 'css' | 'script';

export type SourceFile = {
  readonly path: string;
  readonly kind: SourceKind;
  readonly area: string | null;
  readonly isTest: boolean;
  readonly scope: 'core' | 'extended';
  readonly lines: ReadonlyArray<string>;
};

export type Rule = {
  readonly id: string;
  readonly kinds: ReadonlyArray<SourceKind>;
  readonly ledger?: 'guards' | 'own';
  readonly includeTests?: boolean;
  readonly roots?: ReadonlyArray<string>;
  readonly hint?: string;
  readonly matches?: (line: string) => boolean;
  readonly lines?: (params: { file: SourceFile }) => ReadonlyArray<number>;
  readonly count: (file: SourceFile) => number;
};

export type Counts = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type Ledgers = Readonly<Record<string, Counts>> & {
  readonly core: Counts;
  readonly guards: Counts;
};

export type Offense = {
  readonly ruleId: string;
  readonly path: string;
  readonly count: number;
  readonly allowed: number;
  readonly hint: string | undefined;
  readonly lines?: ReadonlyArray<number>;
};

export const REPO_ROOT: string;
export const BASELINE_FILES: Readonly<Record<'core' | 'guards', string>>;
export const RULES: ReadonlyArray<Rule>;
export const TAURI_CORE_IMPORT: RegExp;
export const FOOTER_CTA_BAR: RegExp;
export const classifyPath: (params: { path: string }) => Omit<SourceFile, 'lines'> | null;
export const readSource: (params: { path: string; text: string }) => SourceFile | null;
export const collectSources: () => ReadonlyArray<SourceFile>;
export const countStringifiedCaughtErrors: (file: SourceFile) => number;
export const componentNameOf: (params: { path: string }) => string | null;
export const isFlatHook: (params: { path: string }) => boolean;
export const withoutStrings: (line: string) => string;
export const applies: (params: { rule: Rule; file: SourceFile }) => boolean;
export const ledgerOf: (params: { rule: Rule; file: SourceFile }) => string;
export const countFor: (params: { rule: Rule; file: SourceFile }) => number;
export const matchedLineNumbers: (params: {
  rule: Rule;
  file: SourceFile;
}) => ReadonlyArray<number>;
export const measure: (params: {
  sources: ReadonlyArray<SourceFile>;
  rules?: ReadonlyArray<Rule>;
}) => Ledgers;
export const serializeLedger: (params: { counts: Counts }) => string;
export const readBaselines: (params?: { root?: string; rules?: ReadonlyArray<Rule> }) => Ledgers;
export const hintOf: (params: { ruleId: string }) => string | undefined;
export const grownOffenses: (params: {
  counts: Ledgers;
  baselines: Ledgers;
}) => ReadonlyArray<Offense>;
export const offensesFor: (params: {
  sources: ReadonlyArray<SourceFile>;
  baselines: Ledgers;
}) => ReadonlyArray<Offense>;
export const describeOffense: (params: { offense: Offense }) => string;
export const ledgerPath: (params: { ledger: string }) => string;
export const shrunkOffenses: (params: {
  counts: Ledgers;
  baselines: Ledgers;
}) => ReadonlyArray<Omit<Offense, 'hint'>>;
export const describeSlack: (params: { offense: Omit<Offense, 'hint'> }) => string;
