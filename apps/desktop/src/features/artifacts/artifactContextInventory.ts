import { formatBriefCount } from './artifactBrief';

const ARTIFACT_CONTEXT_ROW_IDS = [
  'brief',
  'attachments',
  'goal',
  'target',
  'agents',
  'artifacts',
  'plans',
  'diff',
  'checks',
  'events',
  'theme',
  'excluded',
  'size',
] as const;

export type ArtifactContextRowId = (typeof ARTIFACT_CONTEXT_ROW_IDS)[number];

export type ArtifactContextRowState = 'included' | 'partial' | 'missing';

export type ArtifactContextInventoryRow = Readonly<{
  id: ArtifactContextRowId;
  label: string;
  summary: string;
  state: ArtifactContextRowState;
  detail: ReadonlyArray<string>;
}>;

type KeptParams = Readonly<{
  kept: number;
  total: number;
}>;

export const keptRowState = ({ kept, total }: KeptParams): ArtifactContextRowState => {
  if (total === 0) {
    return 'missing';
  }
  return kept < total ? 'partial' : 'included';
};

type BriefRowParams = Readonly<{
  brief: string;
}>;

export const briefInventoryRow = ({ brief }: BriefRowParams): ArtifactContextInventoryRow => {
  const trimmed = brief.trim();
  if (trimmed.length === 0) {
    return {
      id: 'brief',
      label: 'brief',
      summary: 'none, the default request above is sent',
      state: 'missing',
      detail: [],
    };
  }
  return {
    id: 'brief',
    label: 'brief',
    summary: `your brief, ${formatBriefCount({ value: trimmed.length })} characters, secrets redacted`,
    state: 'included',
    detail: [],
  };
};

type SizeRowParams = Readonly<{
  size: number;
  cap: number;
  isCapped: boolean;
}>;

export const sizeInventoryRow = ({
  size,
  cap,
  isCapped,
}: SizeRowParams): ArtifactContextInventoryRow => ({
  id: 'size',
  label: 'size',
  summary: `about ${formatBriefCount({ value: size })} of ${formatBriefCount({ value: cap })} characters`,
  state: isCapped ? 'partial' : 'included',
  detail: isCapped ? ['over the cap, the end of the pack is cut'] : [],
});

type ExcludedRowParams = Readonly<{
  summary: string;
}>;

export const excludedInventoryRow = ({
  summary,
}: ExcludedRowParams): ArtifactContextInventoryRow => ({
  id: 'excluded',
  label: 'never sent',
  summary,
  state: 'missing',
  detail: [],
});

type ReplaceParams = Readonly<{
  rows: ReadonlyArray<ArtifactContextInventoryRow>;
  row: ArtifactContextInventoryRow;
}>;

export const replaceInventoryRow = ({
  rows,
  row,
}: ReplaceParams): ReadonlyArray<ArtifactContextInventoryRow> =>
  rows.map((entry) => (entry.id === row.id ? row : entry));

type CountParams = Readonly<{
  rows: ReadonlyArray<ArtifactContextInventoryRow>;
}>;

export const countCutRows = ({ rows }: CountParams): number =>
  rows.filter((row) => row.state === 'partial').length;
