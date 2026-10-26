import type { SessionStage } from '@goodboy/types';
import { describeStageBucket } from '../../../../session/session-stage';

type Params = {
  readonly stage: SessionStage;
};

export const promiseOf = ({ stage }: Params): string =>
  stage === 'done' ? 'Finished sessions show what shipped' : describeStageBucket({ stage }).reason;
