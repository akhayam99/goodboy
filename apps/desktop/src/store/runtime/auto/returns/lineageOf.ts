import type { AutoDelegation } from '@goodboy/db';
import { delegationReplacesOf } from '../../../../features/auto/delegationReplacesOf';

type Link = Pick<AutoDelegation, 'id' | 'retryOf' | 'request'>;

export type LineageParams<T extends Link> = Readonly<{
  delegation: T;
  delegations: ReadonlyArray<T>;
  shouldFollowReplaces: boolean;
}>;

type ParentParams<T extends Link> = Readonly<{
  row: T;
}>;

export const lineageOf = <T extends Link>({
  delegation,
  delegations,
  shouldFollowReplaces,
}: LineageParams<T>): ReadonlyArray<T> => {
  const byId = new Map<string, T>(delegations.map((row) => [row.id, row]));
  byId.set(delegation.id, delegation);
  const parentOf = ({ row }: ParentParams<T>): string | null =>
    (shouldFollowReplaces ? delegationReplacesOf({ delegation: row }) : null) ?? row.retryOf;
  const climbed = new Set<string>([delegation.id]);
  let root = delegation;
  let parent = byId.get(parentOf({ row: root }) ?? '');
  while (parent !== undefined && !climbed.has(parent.id)) {
    climbed.add(parent.id);
    root = parent;
    parent = byId.get(parentOf({ row: root }) ?? '');
  }
  const lineage = new Map<string, T>([[root.id, root]]);
  let isGrowing = true;
  while (isGrowing) {
    isGrowing = false;
    for (const row of byId.values()) {
      const rowParent = parentOf({ row });
      if (!lineage.has(row.id) && rowParent !== null && lineage.has(rowParent)) {
        lineage.set(row.id, row);
        isGrowing = true;
      }
    }
  }
  return [...lineage.values()];
};
