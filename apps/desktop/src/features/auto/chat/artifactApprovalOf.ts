import type { AutoArtifactLedgerRow } from '@goodboy/db';
import type { Tone } from '@goodboy/ui';
import { AUTO_STATE_TONE } from './autoStateTone';

export type ArtifactApprovalView = Readonly<{
  word: string;
  tone: Tone;
  state: 'needs_approval' | 'approved' | 'revising';
}>;

type Params = {
  readonly row: AutoArtifactLedgerRow;
};

export const artifactApprovalOf = ({ row }: Params): ArtifactApprovalView | null => {
  if (row.artifact.kind !== 'plan') {
    return null;
  }
  switch (row.artifact.approvalState) {
    case 'needs_approval':
      return {
        word: 'Needs approval',
        tone: AUTO_STATE_TONE.waitingOnYou,
        state: 'needs_approval',
      };
    case 'approved':
      return row.artifact.approvedRevision === row.revision
        ? { word: 'Approved', tone: AUTO_STATE_TONE.artifact, state: 'approved' }
        : { word: 'Needs approval', tone: 'warning', state: 'needs_approval' };
    case 'revising':
      return { word: `Revising to v${row.revision + 1}`, tone: 'info', state: 'revising' };
    default: {
      const exhaustive: never = row.artifact.approvalState;
      return exhaustive;
    }
  }
};
