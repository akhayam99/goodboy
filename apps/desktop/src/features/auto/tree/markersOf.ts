import type { AutoArtifactLedgerRow } from '@goodboy/db';

export type PermissionFact = Readonly<{
  agentId: string;
  toolName: string;
  decision: 'allow' | 'deny';
}>;

export type PermissionMark = Readonly<{
  decision: 'allow' | 'deny';
  count: number;
  tools: ReadonlyArray<string>;
}>;

export type LabelledMark = Readonly<{
  id: string;
  artifactId: string;
  label: string;
}>;

export type AgentMarks = Readonly<{
  permissions: ReadonlyArray<PermissionMark>;
  labelled: ReadonlyArray<LabelledMark>;
}>;

export const NO_MARKS: AgentMarks = { permissions: [], labelled: [] };

type Params = {
  readonly permissions: ReadonlyArray<PermissionFact>;
  readonly artifacts: ReadonlyArray<AutoArtifactLedgerRow>;
};

type LabelParams = {
  readonly row: AutoArtifactLedgerRow;
};

const KIND_WORD = {
  plan: 'Plan',
  report: 'Report',
  wireframe: 'Wireframe',
} as const;

export const markLabelOf = ({ row }: LabelParams): string => {
  const word = KIND_WORD[row.artifact.kind];
  const { approvalState, approvedRevision } = row.artifact;
  if (row.artifact.kind === 'plan' && approvalState === 'approved' && approvedRevision !== null) {
    return `${word} v${approvedRevision} approved`;
  }
  return `${word} v${row.revision}`;
};

type FactsParams = {
  readonly facts: ReadonlyArray<PermissionFact>;
};

const permissionMarksOf = ({ facts }: FactsParams): ReadonlyArray<PermissionMark> =>
  (['allow', 'deny'] as const).flatMap((decision): ReadonlyArray<PermissionMark> => {
    const matching = facts.filter((fact) => fact.decision === decision);
    if (matching.length === 0) {
      return [];
    }
    return [
      {
        decision,
        count: matching.length,
        tools: [...new Set(matching.map((fact) => fact.toolName))],
      },
    ];
  });

export const markersOf = ({ permissions, artifacts }: Params): ReadonlyMap<string, AgentMarks> => {
  const agentIds = new Set([
    ...permissions.map((fact) => fact.agentId),
    ...artifacts.map((row) => row.artifact.ownerAgentId),
  ]);
  return new Map(
    [...agentIds].map((agentId): [string, AgentMarks] => [
      agentId,
      {
        permissions: permissionMarksOf({
          facts: permissions.filter((fact) => fact.agentId === agentId),
        }),
        labelled: artifacts
          .filter((row) => row.artifact.ownerAgentId === agentId)
          .sort((left, right) => left.artifact.createdAt - right.artifact.createdAt)
          .map((row) => ({
            id: `mark:${row.artifact.artifactId}`,
            artifactId: row.artifact.artifactId,
            label: markLabelOf({ row }),
          })),
      },
    ]),
  );
};
