const EARLIER_STEP_PREVIEW_LENGTH = 280;
const PARALLEL_BRANCH_PREVIEW_LENGTH = 600;
const PARALLEL_BRANCH_DEGRADED_LENGTH = 280;
const PARALLEL_HANDOFF_MAX_LENGTH = 3000;
const NO_OUTPUT = '(no output captured)';
const NO_ERROR = '(no error captured)';

export type ChainCarryForwardStep = {
  readonly ordinal?: number | null;
  readonly name?: string | null;
  readonly outputSummary?: string | null;
};

export type ParallelCarryForwardBranch = {
  readonly name?: string | null;
  readonly status?: string | null;
  readonly outputSummary?: string | null;
  readonly error?: string | null;
};

type ChainParams = {
  readonly steps?: ReadonlyArray<ChainCarryForwardStep | null | undefined> | null;
};

type ParallelParams = {
  readonly groupName?: string | null;
  readonly branches?: ReadonlyArray<ParallelCarryForwardBranch | null | undefined> | null;
};

type NormalizedParallelBranch = {
  readonly name: string;
  readonly isFailed: boolean;
  readonly body: string;
};

type RenderParallelParams = {
  readonly groupName: string;
  readonly branches: ReadonlyArray<NormalizedParallelBranch>;
  readonly bodyLength: number;
};

const renderParallelCarryForward = ({
  groupName,
  branches,
  bodyLength,
}: RenderParallelParams): string => {
  const lines = ['## workflow handoff', `### parallel group output: ${groupName}`];
  branches.forEach((branch, index) => {
    lines.push(
      `#### branch ${index + 1}: ${branch.name}${branch.isFailed ? ' (failed)' : ''}`,
      branch.body.slice(0, bodyLength),
    );
  });
  return lines.join('\n');
};

export const buildChainCarryForward = ({ steps }: ChainParams): string => {
  const orderedSteps = (steps ?? [])
    .filter((step): step is ChainCarryForwardStep => step != null)
    .map((step) => ({
      ordinal: typeof step.ordinal === 'number' && Number.isFinite(step.ordinal) ? step.ordinal : 0,
      name: typeof step.name === 'string' ? step.name.trim() : '',
      outputSummary: typeof step.outputSummary === 'string' ? step.outputSummary : '',
    }))
    .sort((left, right) => left.ordinal - right.ordinal);
  const immediateStep = orderedSteps.at(-1);
  if (immediateStep == null) {
    return '';
  }

  const immediateSummary = immediateStep.outputSummary.trim();
  const lines = [
    '## workflow handoff',
    `### step ${immediateStep.ordinal} output: ${immediateStep.name}`,
    immediateSummary.length > 0 ? immediateSummary : NO_OUTPUT,
  ];
  if (orderedSteps.length === 1) {
    return lines.join('\n');
  }

  lines.push('### earlier steps');
  const earlierSteps = orderedSteps.slice(0, -1).reverse();
  earlierSteps.forEach((step, index) => {
    const summary = step.outputSummary.trim();
    if (summary.length === 0) {
      lines.push(`- step ${step.ordinal} ${step.name}: ${NO_OUTPUT}`);
      return;
    }
    const preview =
      index === 0 ? summary.slice(0, EARLIER_STEP_PREVIEW_LENGTH) : summary.split(/\r?\n/, 1)[0];
    lines.push(`- step ${step.ordinal} ${step.name}: ${preview ?? ''}`);
  });
  return lines.join('\n');
};

export const buildParallelCarryForward = ({ groupName, branches }: ParallelParams): string => {
  const normalizedBranches = (branches ?? [])
    .filter((branch): branch is ParallelCarryForwardBranch => branch != null)
    .map((branch) => {
      const isFailed = branch.status !== 'completed';
      const outputSummary =
        typeof branch.outputSummary === 'string' ? branch.outputSummary.trim() : '';
      const error = typeof branch.error === 'string' ? branch.error.trim() : '';
      const firstErrorLine = error.split(/\r?\n/, 1)[0] ?? '';
      return {
        name: typeof branch.name === 'string' ? branch.name.trim() : '',
        isFailed,
        body: isFailed
          ? firstErrorLine.length > 0
            ? firstErrorLine
            : NO_ERROR
          : outputSummary.length > 0
            ? outputSummary
            : NO_OUTPUT,
      };
    });
  if (normalizedBranches.length === 0) {
    return '';
  }

  const normalizedGroupName = typeof groupName === 'string' ? groupName.trim() : '';
  const carryForward = renderParallelCarryForward({
    groupName: normalizedGroupName,
    branches: normalizedBranches,
    bodyLength: PARALLEL_BRANCH_PREVIEW_LENGTH,
  });
  if (carryForward.length <= PARALLEL_HANDOFF_MAX_LENGTH) {
    return carryForward;
  }
  return renderParallelCarryForward({
    groupName: normalizedGroupName,
    branches: normalizedBranches,
    bodyLength: PARALLEL_BRANCH_DEGRADED_LENGTH,
  });
};
