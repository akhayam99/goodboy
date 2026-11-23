import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type PrCheckRun, type SessionId } from '@goodboy/types';
import { aMountGithub } from '../../../store/slices/github/testing/aMountGithub';
import { checkLeadItemOf } from './checkLeadItemOf';

const MOUNT = brandId<MountId>({ value: 'mount-payments-api' });
const SESSION = brandId<SessionId>({ value: 'session-hbl-417' });

type RunParams = {
  readonly run: number;
};

const failedRun = ({ run }: RunParams): PrCheckRun => ({
  name: 'integration-tests',
  conclusion: 'failure',
  detailsUrl: `https://github.com/harborline/payments-api/actions/runs/${run}/job/1`,
  durationMs: null,
});

const githubWith = ({ run }: RunParams) => ({
  ...aMountGithub({ mountId: MOUNT }),
  detail: {
    prNumber: 79,
    comments: [],
    reviews: [],
    reviewRequests: [],
    checks: [failedRun({ run })],
  },
});

describe('checkLeadItemOf', () => {
  it('names the failed check run, so a later failure on the same mount is a new send', () => {
    const first = checkLeadItemOf({
      github: githubWith({ run: 31 }),
      reading: undefined,
      sessionId: SESSION,
      mountId: MOUNT,
    });
    const again = checkLeadItemOf({
      github: githubWith({ run: 31 }),
      reading: undefined,
      sessionId: SESSION,
      mountId: MOUNT,
    });
    const later = checkLeadItemOf({
      github: githubWith({ run: 32 }),
      reading: undefined,
      sessionId: SESSION,
      mountId: MOUNT,
    });

    expect(first?.identity).toBe(again?.identity);
    expect(later?.identity).not.toBe(first?.identity);
  });
});
