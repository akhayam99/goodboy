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
    'You were granted a replan. The plan in flight is frozen: nothing queued starts and nothing publishes until your revision is adopted or refused.',
};

export type PlanRevisionNodeBrief = Readonly<{
  id: string;
  title: string;
  role: string;
  state: 'completed' | 'running' | 'unstarted' | 'superseded';
  expectedOutput: string | null;
}>;

export type PlanRevisionBrief = Readonly<{
  goalTitle: string;
  revision: number;
  nodes: ReadonlyArray<PlanRevisionNodeBrief>;
}>;

const planRevisionBlock = ({ brief }: { readonly brief: PlanRevisionBrief }): string => {
  const rows = brief.nodes.map(
    (node) =>
      `- ${node.id} (${node.role}, ${node.state}): ${node.title}${node.expectedOutput === null ? '' : ` [accepts: ${node.expectedOutput}]`}`,
  );
  return [
    `The plan you are revising is "${brief.goalTitle}" at revision ${brief.revision}.`,
    ...rows,
    '',
    'A completed result is reused only where its acceptance criteria and its dependency revisions still hold. A result from an attempt that is still running is quarantined when you supersede it. A completed node cannot be replaced.',
    '',
    'Emit exactly one revision and say what happens to every node above:',
    '<<plan-revision>>',
    JSON.stringify(
      {
        baseRevision: brief.revision,
        nodes: [
          { disposition: 'retain', id: 'a-node-you-keep' },
          {
            disposition: 'replace',
            id: 'a-node-you-drop',
            node: {
              id: 'its-replacement',
              title: 'what it does',
              instructions: 'what the agent must do',
              role: 'implementer',
              dependsOn: ['a-node-you-keep'],
              expectedOutput: 'what proves it done',
            },
          },
          {
            disposition: 'append',
            node: {
              id: 'a-new-node',
              title: 'what it does',
              instructions: 'what the agent must do',
              role: 'tester',
              dependsOn: ['its-replacement'],
              expectedOutput: 'what proves it done',
            },
          },
        ],
      },
      null,
      2,
    ),
    '<</plan-revision>>',
  ].join('\n');
};

type KickoffParams = {
  readonly request: CapabilityRequest;
  readonly requesterName: string;
  readonly promptPrefix: string;
  readonly transfer: TransferPacket | null;
  readonly planRevision: PlanRevisionBrief | null;
};

export const composeCapabilityKickoff = ({
  request,
  requesterName,
  promptPrefix,
  transfer,
  planRevision,
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
  if (planRevision !== null) {
    lines.push('', planRevisionBlock({ brief: planRevision }));
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
    lines.push(
      transfer.replacementRole === null
        ? 'You own both the capability above and that remaining work.'
        : `You own the capability above only. The remaining work goes to a replacement ${transfer.replacementRole} once you report back.`,
    );
  }
  return lines.join('\n');
};

type TransferSummaryParams = {
  readonly grantedRole: string;
  readonly purpose: CapabilityPurpose;
};

export const transferredParentSummary = ({ grantedRole, purpose }: TransferSummaryParams): string =>
  `partial, transferred: this attempt ended without finishing its work and its remaining responsibility moved to a ${grantedRole} granted for ${purpose}. its context was not preserved.`;
