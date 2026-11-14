import { publishOfResult, pullRequestOfResult } from '@goodboy/core/auto';
import type { AutoGrantKind } from '@goodboy/db';
import type { AutoDelegationId, AutoTreeId } from '@goodboy/types';
import type { AutoTreeView } from '../../../slices/auto-view/state';
import { leadAskIdOf } from './leadAskIdOf';

export type LeadAskKind = 'start' | 'push' | AutoGrantKind;

export type LeadAsk = Readonly<{
  id: string;
  kind: LeadAskKind;
  treeId: AutoTreeId;
  delegationId: AutoDelegationId | null;
  subject: string;
}>;

const CLOSED_PHASES: ReadonlySet<string> = new Set(['stopping', 'stopped', 'finished']);

type Params = {
  readonly view: AutoTreeView;
};

export const leadAsksOf = ({ view }: Params): ReadonlyArray<LeadAsk> => {
  const { tree } = view;
  if (tree.stopState !== 'none' || CLOSED_PHASES.has(tree.phase)) {
    return [];
  }
  const fromDelegations = view.delegations.flatMap((delegation): ReadonlyArray<LeadAsk> => {
    if (delegation.generation !== tree.generation) {
      return [];
    }
    if (delegation.state === 'awaiting_confirm') {
      return [
        {
          id: leadAskIdOf({ ref: { kind: 'start', delegationId: delegation.id } }),
          kind: 'start',
          treeId: tree.id,
          delegationId: delegation.id,
          subject: delegation.role,
        },
      ];
    }
    const publish = publishOfResult({ result: delegation.result });
    if (delegation.state !== 'settled' || publish?.state !== 'awaiting_confirm') {
      return [];
    }
    return [
      {
        id: leadAskIdOf({
          ref: { kind: 'push', delegationId: delegation.id, sha: publish.sha ?? '' },
        }),
        kind: 'push',
        treeId: tree.id,
        delegationId: delegation.id,
        subject: publish.branch ?? '',
      },
    ];
  });
  const heldGrantIds = new Set(
    view.delegations
      .filter(
        (delegation) => delegation.state === 'settled' && delegation.generation === tree.generation,
      )
      .map((delegation) => pullRequestOfResult({ result: delegation.result })?.grantId),
  );
  const fromGrants = (view.grantAsks ?? [])
    .filter((grant) => grant.state === 'asked' && grant.isCurrent)
    .filter((grant) => grant.kind !== 'pull_request' || heldGrantIds.has(grant.id))
    .map((grant): LeadAsk => ({
      id: leadAskIdOf({ ref: { kind: 'grant', grantId: grant.id } }),
      kind: grant.kind,
      treeId: tree.id,
      delegationId: grant.delegationId,
      subject: grant.subject,
    }));
  const seen = new Set<string>();
  return [...fromDelegations, ...fromGrants].filter((ask) => {
    if (seen.has(ask.id)) {
      return false;
    }
    seen.add(ask.id);
    return true;
  });
};
