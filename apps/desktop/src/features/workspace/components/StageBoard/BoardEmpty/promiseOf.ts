import { sentenceCase } from '../../../../../shared/utils/sentenceCase';
import { ARCHIVED_LANE, describeStageBucket } from '../../../../session/session-stage';
import type { BoardLaneSpec } from '../boardLaneSpecs';

type Params = {
  readonly spec: BoardLaneSpec;
};

export const promiseOf = ({ spec }: Params): string => {
  if (spec.kind === 'archived') {
    return sentenceCase({ text: ARCHIVED_LANE.reason });
  }
  return spec.stage === 'done'
    ? 'Finished sessions show what shipped'
    : describeStageBucket({ stage: spec.stage }).reason;
};
