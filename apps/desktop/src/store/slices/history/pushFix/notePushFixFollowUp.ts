import { recordPushFixFollowUp } from './recordPushFixOutcome';
import type { SliceDeps } from '../../../slice-types';
import type { PushFixFollowUp, PushFixOutcome } from '../types';

type Params = {
  readonly mountId: PushFixOutcome['mountId'];
  readonly agentId: PushFixOutcome['agentId'];
  readonly followUp: PushFixFollowUp;
};

export const notePushFixFollowUp = ({ set, get }: SliceDeps) => {
  return ({ mountId, agentId, followUp }: Params): void =>
    recordPushFixFollowUp({ set, get, mountId, agentId, followUp });
};
