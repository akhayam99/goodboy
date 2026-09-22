import type { CapabilityPurpose, CapabilityRequest } from '@goodboy/types';

export type TransferPacket = Readonly<{
  replacementRole: string | null;
  completedWork: string;
  remainingCriteria: string;
  evidenceRefs: ReadonlyArray<string>;
  executionTarget: string | null;
}>;

const PURPOSE_HEADLINE: Readonly<Record<CapabilityPurpose, string>> = {
  discovery: 'You were granted a discovery pass for another agent.',
  diagnosis: 'You were granted a diagnosis for another agent.',
  repair: 'You were granted a bounded repair for a recorded finding.',
  test: 'You were granted a test pass for a recorded finding.',
  replan:
    'You were granted a replan. The plan in flight stays frozen and nothing is superseded yet.',
};

type KickoffParams = {
  readonly request: CapabilityRequest;
  readonly requesterName: string;
  readonly promptPrefix: string;
  readonly transfer: TransferPacket | null;
};

export const composeCapabilityKickoff = ({
  request,
  requesterName,
  promptPrefix,
  transfer,
}: KickoffParams): string => {
  const lines = [
    PURPOSE_HEADLINE[request.purpose],
    '',
    promptPrefix.trim(),
    '',
    `Question from ${requesterName}: ${request.question}`,
  ];
  if (request.gap.length > 0) {
    lines.push(`Gap it could not close: ${request.gap}`);
  }
  if (request.scope.length > 0) {
    lines.push(`Scope: ${request.scope.join(', ')}`);
  }
  if (request.expectedOutput.length > 0) {
    lines.push(`Expected result: ${request.expectedOutput}`);
  }
  if (request.evidenceRefs.length > 0) {
    lines.push(`Evidence already referenced: ${request.evidenceRefs.join(', ')}`);
  }
  if (transfer !== null) {
    lines.push(
      '',
      `${requesterName} could not be resumed, so its remaining work was transferred rather than preserved. Nothing of its internal context survives: read the references below rather than assuming them.`,
      `Work already landed: ${transfer.completedWork}`,
      `Acceptance criteria still open: ${transfer.remainingCriteria}`,
    );
    if (transfer.executionTarget !== null) {
      lines.push(`Execution target: ${transfer.executionTarget}`);
    }
    if (transfer.replacementRole === null) {
      lines.push('You own both the capability above and that remaining work.');
    } else {
      lines.push(
        `You own the capability above only. The remaining work goes to a replacement ${transfer.replacementRole} once you report back.`,
      );
    }
  }
  return lines.join('\n');
};

type TransferSummaryParams = {
  readonly grantedRole: string;
  readonly purpose: CapabilityPurpose;
};

export const transferredParentSummary = ({ grantedRole, purpose }: TransferSummaryParams): string =>
  `partial, transferred: this attempt ended without finishing its work and its remaining responsibility moved to a ${grantedRole} granted for ${purpose}. its context was not preserved.`;
