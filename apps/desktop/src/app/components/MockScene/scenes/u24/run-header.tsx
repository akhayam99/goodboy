import { PAUSED_SESSION } from '../flow-audit/runControl';
import { PLAN_HOLD_DYNAMIC_SESSION } from '../flow-audit/planHoldRun';
import { RunHeaderScene } from './run-header/RunHeaderScene';
import {
  ARCHIVED_SESSION,
  FAILED_SESSION,
  seedRunHeaderArchived,
  seedRunHeaderFailed,
  seedRunHeaderHeld,
  seedRunHeaderPaused,
} from './run-header/runHeaderSeeds';

export const U24_RUN_HEADER_SCENES = {
  'run-header-held': () => (
    <RunHeaderScene session={PLAN_HOLD_DYNAMIC_SESSION} seed={seedRunHeaderHeld} />
  ),
  'run-header-paused': () => <RunHeaderScene session={PAUSED_SESSION} seed={seedRunHeaderPaused} />,
  'run-header-failed': () => <RunHeaderScene session={FAILED_SESSION} seed={seedRunHeaderFailed} />,
  'run-header-archived': () => (
    <RunHeaderScene session={ARCHIVED_SESSION} seed={seedRunHeaderArchived} />
  ),
};
