import { describe, expect, it } from 'vitest';
import { pullRequestOfResult } from '@goodboy/core/auto';
import { leadAsksOf } from '../../../store/runtime/auto/asks/leadAsksOf';
import { workLeadPushView } from './workLeadPushView';

describe('the data of the work-lead-push scene', () => {
  it('holds one push ask and one pull request ask, each by its own id', () => {
    const view = workLeadPushView();
    const asks = leadAsksOf({ view });

    expect(asks.map((ask) => [ask.kind, ask.subject])).toEqual([
      ['push', 'harborline/ledger-export'],
      ['pull_request', 'mount-ledger-core'],
    ]);
    expect(asks[0]?.id).toContain(':abc1234def5678');
  });

  it('carries the text the pull request ask will publish', () => {
    const scribe = workLeadPushView().delegations.find((row) => row.role === 'scribe');

    expect(pullRequestOfResult({ result: scribe?.result })).toMatchObject({
      state: 'awaiting_confirm',
      title: 'Export the ledger as CSV',
    });
  });
});
