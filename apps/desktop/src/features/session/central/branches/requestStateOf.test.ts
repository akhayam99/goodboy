// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MountRequestView } from '../../../../store/slices/project-mounts/mountRowModel';
import { isReadyState } from '../board/branchRowOf';
import { requestStateOf } from './requestStateOf';

type RequestParams = Partial<
  Pick<MountRequestView, 'state' | 'isDraft' | 'checks' | 'reviewDecision'>
>;

const requestOf = ({
  state = 'open',
  isDraft = false,
  checks = null,
  reviewDecision = null,
}: RequestParams): MountRequestView => ({
  provider: 'github',
  identity: null,
  number: 12,
  state,
  isDraft,
  checks,
  reviewDecision,
  url: '',
  title: '',
  label: 'PR #12',
});

const isReady = (params: RequestParams): boolean =>
  isReadyState({ state: requestStateOf({ request: requestOf(params) }) });

describe('a branch another branch waits on', () => {
  it('is ready, approved or queued, by the same states the row uses', () => {
    expect(isReady({ checks: 'success' })).toBe(true);
    expect(isReady({ reviewDecision: 'approved' })).toBe(true);
    expect(isReady({ state: 'queued' })).toBe(true);
  });

  it('is not ready as a draft, failing, merged or still running checks', () => {
    expect(isReady({ isDraft: true, checks: 'success' })).toBe(false);
    expect(isReady({ checks: 'failure' })).toBe(false);
    expect(isReady({ state: 'merged', checks: 'success' })).toBe(false);
    expect(isReady({ checks: 'pending' })).toBe(false);
  });
});
