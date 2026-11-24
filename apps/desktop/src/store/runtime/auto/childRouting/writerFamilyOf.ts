import {
  isAutoWriterRole,
  parseAutoDelegationRole,
  type AutoDelegationRole,
} from '@goodboy/core/auto';
import { modelFamily, type ModelFamily } from '@goodboy/core/providers';
import {
  getAutoArtifact,
  getAutoDelegation,
  listAutoArtifactVersions,
  type AutoTree,
} from '@goodboy/db';
import { brandId, type ArtifactId } from '@goodboy/types';
import type { AgentVerbContext } from '../verbContext';
import { storedPickOf } from './storedPickOf';

type Params = {
  readonly ctx: AgentVerbContext;
  readonly tree: AutoTree;
  readonly role: AutoDelegationRole;
  readonly inputs: ReadonlyArray<Readonly<{ artifactId: string; revision: number }>>;
};

export const writerFamilyOf = async ({
  ctx,
  tree,
  role,
  inputs,
}: Params): Promise<ModelFamily | null> => {
  if (role !== 'reviewer') {
    return null;
  }
  for (const input of inputs) {
    const artifactId = brandId<ArtifactId>({ value: input.artifactId });
    const registered = await getAutoArtifact({ db: ctx.db, artifactId });
    const ownerRole =
      registered === null ? null : parseAutoDelegationRole({ role: registered.ownerRole });
    if (
      registered === null ||
      registered.treeId !== tree.id ||
      ownerRole === null ||
      !isAutoWriterRole({ role: ownerRole })
    ) {
      continue;
    }
    const versions = await listAutoArtifactVersions({ db: ctx.db, artifactId });
    const version = versions.find((row) => row.revision === input.revision);
    const producer = await getAutoDelegation({
      db: ctx.db,
      delegationId: version?.delegationId ?? registered.ownerDelegationId,
    });
    const pick = producer === null ? null : storedPickOf({ routing: producer.routing });
    const family =
      pick === null ? null : modelFamily({ provider: pick.provider, model: pick.model });
    if (family !== null) {
      return family;
    }
  }
  return null;
};
