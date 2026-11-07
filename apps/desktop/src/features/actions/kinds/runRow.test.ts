// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RUN_ROW_KIND } from './runRow';

const OPEN_ONLY_OR_LIVE_ONLY = ['workflowRun.pause', 'workflowRun.resume', 'workflowRun.restore'];

describe('RUN_ROW_KIND', () => {
  it('acts on the run with rename first, and never shows more than five rows at once', () => {
    const ids = RUN_ROW_KIND.actions.map((action) => action.id);

    expect(ids).toContain('workflowRun.rename');
    expect(ids.filter((id) => !OPEN_ONLY_OR_LIVE_ONLY.includes(id)).length + 1).toBeLessThan(6);
  });

  it('carries no verb of the page head', () => {
    const ids = RUN_ROW_KIND.actions.map((action) => action.id);

    expect(ids).not.toContain('workflowRun.routing');
    expect(ids).not.toContain('workflowRun.saveAsPreset');
  });
});
