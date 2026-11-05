import type { AutoArtifactLedgerRow } from '@goodboy/db';
import type { AutoLevel } from '@goodboy/core/auto';
import type { Tone } from '@goodboy/ui';
import { AUTO_STATE_TONE } from './autoStateTone';

export type ArtifactApprovalView = Readonly<{
  word: string;
  tone: Tone;
  state: 'needs_approval' | 'approved' | 'revising' | 'used' | 'not_needed';
}>;

type Params = {
  readonly row: AutoArtifactLedgerRow;
  readonly level?: AutoLevel | undefined;
};

export const artifactApprovalOf = ({ row, level }: Params): ArtifactApprovalView | null => {
  if (row.artifact.kind !== 'plan') {
    return null;
  }
  if (row.status === 'consumed') {
    return { word: 'Used', tone: AUTO_STATE_TONE.artifact, state: 'used' };
  }
  switch (row.artifact.approvalState) {
    case 'needs_approval':
      if (level === 'run') {
        return { word: 'No approval needed', tone: AUTO_STATE_TONE.artifact, state: 'not_needed' };
      }
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
