export const REPORT_ALLOCATION_LIMITS = {
  framing: 8_000,
  truncationNotes: 2_000,
  evidence: 8_000,
  olderAgentReserve: 600,
} as const;

const TRUNCATION_MARKER = '...';
const RETAIN_RATIO = 0.5;

export type BoundaryClipParams = Readonly<{ text: string; limit: number }>;

export type BoundaryClipResult = Readonly<{ text: string; isClipped: boolean }>;

const findStructuralBoundary = ({
  window,
  budget,
}: Readonly<{ window: string; budget: number }>): number | null => {
  const minAccept = Math.floor(budget * RETAIN_RATIO);
  const paragraph = window.lastIndexOf('\n\n');
  if (paragraph >= minAccept) {
    return paragraph;
  }
  const line = window.lastIndexOf('\n');
  if (line >= minAccept) {
    return line;
  }
  const sentenceMatches = [...window.matchAll(/[.!?](?=\s|$)/g)];
  const lastSentence = sentenceMatches[sentenceMatches.length - 1];
  if (lastSentence !== undefined && lastSentence.index + 1 >= minAccept) {
    return lastSentence.index + 1;
  }
  const space = window.lastIndexOf(' ');
  if (space >= minAccept) {
    return space;
  }
  return null;
};

export const clipToBoundary = ({ text, limit }: BoundaryClipParams): BoundaryClipResult => {
  const collapsed = text.trim();
  if (collapsed.length <= limit) {
    return { text: collapsed, isClipped: false };
  }
  if (limit <= 0) {
    return { text: '', isClipped: true };
  }
  if (limit <= TRUNCATION_MARKER.length) {
    return { text: collapsed.slice(0, limit), isClipped: true };
  }
  const budget = limit - TRUNCATION_MARKER.length;
  const window = collapsed.slice(0, budget);
  const boundary = findStructuralBoundary({ window, budget });
  const cut = boundary === null ? window : window.slice(0, boundary);
  const trimmed = cut.trimEnd();
  const base = trimmed.length === 0 ? window : trimmed;
  return { text: `${base}${TRUNCATION_MARKER}`, isClipped: true };
};

export type BudgetBlock = Readonly<{ id: string; text: string }>;

export type FitWithinBudgetResult = Readonly<{
  blocks: ReadonlyArray<BudgetBlock>;
  clippedIds: ReadonlyArray<string>;
}>;

type FitWithinBudgetParams = Readonly<{
  blocks: ReadonlyArray<BudgetBlock>;
  budget: number;
}>;

export const fitWithinBudget = ({
  blocks,
  budget,
}: FitWithinBudgetParams): FitWithinBudgetResult => {
  const total = blocks.reduce((sum, block) => sum + block.text.length, 0);
  if (total <= budget) {
    return { blocks, clippedIds: [] };
  }
  let overflow = total - budget;
  const clippedIds: Array<string> = [];
  const result = [...blocks];
  for (let index = result.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const block = result[index];
    if (block === undefined || block.text.length === 0) {
      continue;
    }
    const allowed = Math.max(0, block.text.length - overflow);
    if (allowed >= block.text.length) {
      continue;
    }
    const clipped = clipToBoundary({ text: block.text, limit: allowed });
    overflow -= block.text.length - clipped.text.length;
    result[index] = { id: block.id, text: clipped.text };
    clippedIds.push(block.id);
  }
  return { blocks: result, clippedIds };
};

export type ReportAgentCandidate = Readonly<{
  id: string;
  ordinal: number;
  lastAssistantAt: string | null;
  textLength: number;
}>;

export type ReportAgentAllocation = Readonly<{
  id: string;
  budget: number;
}>;

export type ReportContextUsage = Readonly<{
  framingUsed: number;
  truncationNotesUsed: number;
  evidenceUsed: number;
}>;

export type ReportContextAllocation = Readonly<{
  agentPool: number;
  agents: ReadonlyArray<ReportAgentAllocation>;
}>;

type AllocateReportContextParams = Readonly<{
  totalCap: number;
  usage: ReportContextUsage;
  agents: ReadonlyArray<ReportAgentCandidate>;
}>;

const compareRecency = (left: ReportAgentCandidate, right: ReportAgentCandidate): number => {
  const leftAt = left.lastAssistantAt ?? '';
  const rightAt = right.lastAssistantAt ?? '';
  if (leftAt !== rightAt) {
    return leftAt < rightAt ? 1 : -1;
  }
  if (left.ordinal !== right.ordinal) {
    return right.ordinal - left.ordinal;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
};

export const allocateReportContext = ({
  totalCap,
  usage,
  agents,
}: AllocateReportContextParams): ReportContextAllocation => {
  const reservedFraming = Math.min(usage.framingUsed, REPORT_ALLOCATION_LIMITS.framing);
  const reservedTruncation = Math.min(
    usage.truncationNotesUsed,
    REPORT_ALLOCATION_LIMITS.truncationNotes,
  );
  const reservedEvidence = Math.min(usage.evidenceUsed, REPORT_ALLOCATION_LIMITS.evidence);
  const agentPool = Math.max(0, totalCap - reservedFraming - reservedTruncation - reservedEvidence);

  const withText = agents.filter((agent) => agent.textLength > 0);
  if (withText.length === 0) {
    return { agentPool, agents: [] };
  }

  const ordered = [...withText].sort(compareRecency);
  const [newest, ...older] = ordered;
  if (newest === undefined) {
    return { agentPool, agents: [] };
  }

  let remainingPool = agentPool;
  const olderReserved = older.map((agent) => {
    const reserve = Math.min(REPORT_ALLOCATION_LIMITS.olderAgentReserve, agent.textLength);
    const given = Math.min(reserve, Math.max(0, remainingPool));
    remainingPool -= given;
    return given;
  });

  const reservedForOlder = olderReserved.reduce((sum, value) => sum + value, 0);
  const newestBudget = Math.max(0, agentPool - reservedForOlder);
  const newestAlloc = Math.min(newestBudget, newest.textLength);
  let leftover = newestBudget - newestAlloc;

  const olderFinal = older.map((agent, index) => {
    let alloc = olderReserved[index] ?? 0;
    if (leftover > 0) {
      const room = Math.max(0, agent.textLength - alloc);
      const give = Math.min(leftover, room);
      alloc += give;
      leftover -= give;
    }
    return { id: agent.id, budget: alloc };
  });

  return {
    agentPool,
    agents: [{ id: newest.id, budget: newestAlloc }, ...olderFinal],
  };
};
