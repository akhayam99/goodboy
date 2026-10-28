import type { MountId } from '@goodboy/types';
import { ReportedError } from '../notifications/reportedError';

type Params = {
  readonly branch: string;
  readonly mountId: MountId;
  readonly output: string;
};

export class PrPushFailedError extends ReportedError {
  readonly mountId: MountId;
  readonly output: string;

  constructor({ branch, mountId, output }: Params) {
    super(`Couldn't push ${branch}: ${output}`);
    this.name = 'PrPushFailedError';
    this.mountId = mountId;
    this.output = output;
  }
}
