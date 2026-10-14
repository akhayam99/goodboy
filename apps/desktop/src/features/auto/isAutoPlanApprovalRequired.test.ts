import { describe, expect, it } from 'vitest';
import { SETTING_AUTO_PLAN_APPROVAL } from '../settings/settings';
import { isAutoPlanApprovalRequired } from './isAutoPlanApprovalRequired';

type RawParams = {
  readonly raw?: string;
};

const read = ({ raw }: RawParams = {}): boolean =>
  isAutoPlanApprovalRequired({
    settings: raw === undefined ? {} : { [SETTING_AUTO_PLAN_APPROVAL]: raw },
  });

describe('isAutoPlanApprovalRequired', () => {
  it('is required unless the stored value is exactly false', () => {
    expect(read()).toBe(true);
    expect(read({ raw: 'true' })).toBe(true);
    expect(read({ raw: '' })).toBe(true);
    expect(read({ raw: 'FALSE' })).toBe(true);
    expect(read({ raw: '0' })).toBe(true);
    expect(read({ raw: 'false' })).toBe(false);
  });
});
