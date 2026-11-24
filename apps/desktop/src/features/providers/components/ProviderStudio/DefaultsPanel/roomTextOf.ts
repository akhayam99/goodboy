import type { CandidateInputs, CandidateRoom } from '@goodboy/core/providers';
import type { ProviderId } from '@goodboy/types';

type Params = {
  readonly provider: ProviderId;
  readonly inputs: CandidateInputs;
};

type UsedParams = {
  readonly room: CandidateRoom;
};

const usedTextOf = ({ room }: UsedParams): string =>
  room.isEstimated ? `about ${room.usedPercent}% used, estimated` : `${room.usedPercent}% used`;

export const roomTextOf = ({ provider, inputs }: Params): string => {
  if (inputs.coolingDown?.includes(provider) === true) {
    return 'cooling down';
  }
  if (inputs.atLimit?.includes(provider) === true) {
    return 'at its limit';
  }
  const room = inputs.room?.[provider];
  return room === undefined ? 'no reading' : usedTextOf({ room });
};
