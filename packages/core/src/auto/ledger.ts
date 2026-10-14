import {
  AUTO_LEDGER_CHAR_BUDGET,
  AUTO_LEDGER_MAX_ARTIFACTS,
  AUTO_LEDGER_OUTLINE_CHARS,
} from './limits';

export type AutoApprovalView = 'needs_approval' | 'approved' | 'revising';

type EffectiveApprovalParams = {
  readonly approvalState: AutoApprovalView;
  readonly approvedRevision: number | null;
  readonly revision: number;
  readonly openReviseDelegationId: string | null;
};

export const effectiveApproval = ({
  approvalState,
  approvedRevision,
  revision,
  openReviseDelegationId,
}: EffectiveApprovalParams): AutoApprovalView => {
  if (openReviseDelegationId !== null) {
    return 'revising';
  }
  if (approvalState === 'approved' && approvedRevision === revision) {
    return 'approved';
  }
  return 'needs_approval';
};

type OutlineParams = {
  readonly sourceText: string;
};

export const artifactOutline = ({ sourceText }: OutlineParams): string => {
  const headings = sourceText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'))
    .map((line) => line.replace(/^#+\s*/, ''));
  return headings.join(' / ').slice(0, AUTO_LEDGER_OUTLINE_CHARS);
};

export type AutoLedgerEntry = Readonly<{
  artifactId: string;
  kind: string;
  title: string;
  revision: number;
  status: string;
  producerAgentId: string;
  producerDelegationId: string;
  producerRole: string;
  lastAuthor: string | null;
  lastAsk: string | null;
  approval: AutoApprovalView;
  openReviseDelegationId: string | null;
  consumerDelegationIds: ReadonlyArray<string>;
  contentHash: string;
  updatedAt: number;
  outline: string;
}>;

type EntryLineParams = {
  readonly entry: AutoLedgerEntry;
};

type OneLineParams = {
  readonly text: string;
};

const oneLine = ({ text }: OneLineParams): string => text.replace(/\s+/g, ' ').trim();

const entryLine = ({ entry }: EntryLineParams): string => {
  const last =
    entry.lastAuthor === null
      ? 'no history'
      : `last edit by ${entry.lastAuthor}${entry.lastAsk === null ? '' : `: ${oneLine({ text: entry.lastAsk })}`}`;
  const revise =
    entry.openReviseDelegationId === null ? '' : `; revise open in ${entry.openReviseDelegationId}`;
  const consumers =
    entry.consumerDelegationIds.length === 0
      ? ''
      : `; used by ${entry.consumerDelegationIds.join(', ')}`;
  return [
    `- ${entry.artifactId} (${entry.kind}) "${oneLine({ text: entry.title })}" v${entry.revision}, ${entry.status}, approval ${entry.approval}${revise}`,
    `  made by ${entry.producerRole} ${entry.producerAgentId} in ${entry.producerDelegationId}; ${last}${consumers}`,
    `  hash ${entry.contentHash.slice(0, 12)}, updated ${new Date(entry.updatedAt).toISOString()}${entry.outline === '' ? '' : `, outline: ${entry.outline}`}`,
  ].join('\n');
};

type LedgerBlockParams = {
  readonly entries: ReadonlyArray<AutoLedgerEntry>;
  readonly nowMs: number;
  readonly generation: number;
};

export const buildArtifactLedgerBlock = ({
  entries,
  nowMs,
  generation,
}: LedgerBlockParams): string => {
  const header = `Artifacts in this tree, as of ${new Date(nowMs).toISOString()}, generation ${generation}. To change one, delegate with revises. Never create a second artifact to change one.`;
  if (entries.length === 0) {
    return `${header}\nNone yet.`;
  }
  const lines: string[] = [];
  let used = header.length;
  for (const entry of entries.slice(0, AUTO_LEDGER_MAX_ARTIFACTS)) {
    const line = entryLine({ entry });
    if (used + line.length + 1 > AUTO_LEDGER_CHAR_BUDGET && lines.length > 0) {
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  const hidden = entries.length - lines.length;
  const tail =
    hidden > 0 ? [`${hidden} more not shown. Read one with agent status --artifact <id>.`] : [];
  return [header, ...lines, ...tail].join('\n');
};
