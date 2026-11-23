import type { SessionId } from '@goodboy/types';
import type { BranchTab, Place } from '../../store/slices/navigation/types';
import { branchTabPlaceOf } from './branchTabPlaceOf';
import type { BranchState } from '../session/central/branches/branchStateTone';
import type { SessionSuggestion } from '../suggestions/types';

export type BranchFact = BranchState | SessionSuggestion['kind'];

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: string;
  readonly fact: BranchFact | null;
};

const FACT_TAB: Partial<Readonly<Record<BranchFact, BranchTab>>> = {
  'checks-failing': 'checks',
  'checks-running': 'checks',
  'fix-checks': 'checks',
  'rerun-check': 'checks',
  'changes-requested': 'comments',
  'resolve-threads': 'comments',
  'check-changes': 'files',
  conflicts: 'commits',
  rebasing: 'commits',
  'not-pushed': 'commits',
  'push-branch': 'commits',
};

export const tabForFactOf = ({ sessionId, mountId, fact }: Params): Place =>
  branchTabPlaceOf({
    sessionId,
    mountId,
    tab: fact === null ? 'pr' : (FACT_TAB[fact] ?? 'pr'),
  });
