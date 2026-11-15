import {
  isAdmissionPlanGateOn,
  isAutoWriterRole,
  type AdmissionSnapshot,
  type AutoDelegationRole,
} from '@goodboy/core/auto';
import { autoInputArtifactStatements, type Statement } from '@goodboy/db';
import type { ArtifactId, AutoTreeId } from '@goodboy/types';

export type InputArtifactStatementsParams = Readonly<{
  treeId: AutoTreeId;
  slot: number;
  role: AutoDelegationRole;
  inputArtifacts: ReadonlyArray<Readonly<{ artifactId: ArtifactId; revision: number }>>;
  snapshot: AdmissionSnapshot;
  nowMs: number;
}>;

export const inputArtifactStatementsOf = ({
  treeId,
  slot,
  role,
  inputArtifacts,
  snapshot,
  nowMs,
}: InputArtifactStatementsParams): ReadonlyArray<Statement> =>
  inputArtifacts.flatMap((ref) => {
    const registered = snapshot.artifacts.find((facts) => facts.artifactId === ref.artifactId);
    const isPlan = registered?.registered?.kind === 'plan';
    const isWriter = isAutoWriterRole({ role });
    return autoInputArtifactStatements({
      treeId,
      slot,
      artifactId: ref.artifactId,
      revision: ref.revision,
      isApprovalRequired: isAdmissionPlanGateOn(snapshot) && isPlan && isWriter,
      isConsumed: isPlan && isWriter,
      nowMs,
    });
  });
