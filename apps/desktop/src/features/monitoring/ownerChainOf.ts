import type { PortOwner } from '@goodboy/core/monitoring';
import { brandId, type AgentId, type SessionId, type WorkflowRunId } from '@goodboy/types';
import { agentPlace, branchPlace, sessionPlace } from '../../store/slices/navigation/place';
import type { PlaceRequest } from '../../store/slices/navigation/types';
import { ledgerKindWord } from './ledgerKindWord';

export type OwnerLinkKind = 'session' | 'branch' | 'agent' | 'run';

export type OwnerLink = {
  readonly kind: OwnerLinkKind;
  readonly word: string | null;
  readonly label: string;
  readonly to: PlaceRequest | null;
};

export type OwnerBranch = {
  readonly name: string;
  readonly mountPath: string | null;
};

type Params = {
  readonly owner: PortOwner;
  readonly sessionTitle: string | null;
  readonly agentName: string | null;
  readonly runTitle: string | null;
  readonly branch: OwnerBranch | null;
};

type BranchLinkParams = {
  readonly sessionId: SessionId;
  readonly word: string | null;
  readonly branch: OwnerBranch | null;
};

const branchLinks = ({ sessionId, word, branch }: BranchLinkParams): ReadonlyArray<OwnerLink> =>
  branch === null
    ? []
    : [
        {
          kind: 'branch',
          word,
          label: branch.name,
          to:
            branch.mountPath === null
              ? null
              : branchPlace({ sessionId, mountPath: branch.mountPath, tab: 'pr' }),
        },
      ];

export const ownerChainOf = ({
  owner,
  sessionTitle,
  agentName,
  runTitle,
  branch,
}: Params): ReadonlyArray<OwnerLink> => {
  if (
    owner.kind === 'external' ||
    owner.kind === 'project' ||
    owner.sessionId === null ||
    owner.sessionId === ''
  ) {
    return [];
  }
  const sessionId = brandId<SessionId>({ value: owner.sessionId });
  const head: ReadonlyArray<OwnerLink> =
    sessionTitle === null
      ? []
      : [{ kind: 'session', word: null, label: sessionTitle, to: sessionPlace({ sessionId }) }];
  if (owner.kind === 'worktree') {
    return [...head, ...branchLinks({ sessionId, word: null, branch })];
  }
  const word = ledgerKindWord({ kind: owner.ledgerKind });
  const agent: ReadonlyArray<OwnerLink> =
    owner.agentId === undefined || owner.agentId === '' || agentName === null
      ? []
      : [
          {
            kind: 'agent',
            word,
            label: agentName,
            to: agentPlace({ sessionId, agentId: brandId<AgentId>({ value: owner.agentId }) }),
          },
        ];
  const run: ReadonlyArray<OwnerLink> =
    owner.runId === undefined || owner.runId === '' || runTitle === null
      ? []
      : [
          {
            kind: 'run',
            word: 'run',
            label: runTitle,
            to: sessionPlace({
              sessionId,
              lens: 'workflows',
              target: { kind: 'run', runId: brandId<WorkflowRunId>({ value: owner.runId }) },
            }),
          },
        ];
  if (agent.length + run.length > 0) {
    return [...head, ...agent, ...run];
  }
  return [...head, ...branchLinks({ sessionId, word, branch })];
};
