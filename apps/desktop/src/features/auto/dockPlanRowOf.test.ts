// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { anArtifactRow, aPlanRow, aView } from './testing/autoViewFixtures';
import { dockPlanRowOf } from './dockPlanRowOf';

describe('dockPlanRowOf', () => {
  it('takes the plan that waits for you over a newer or older plan', () => {
    const newest = {
      ...anArtifactRow({ id: 'artifact-plan-3', kind: 'plan', title: 'C' }),
      status: 'consumed',
    } as const;
    const waiting = anArtifactRow({ id: 'artifact-plan-2', kind: 'plan', title: 'B', revision: 2 });
    const oldest = {
      ...anArtifactRow({ id: 'artifact-plan-1', kind: 'plan', title: 'A' }),
      status: 'consumed',
    } as const;

    const row = dockPlanRowOf({ view: aView({ artifacts: [newest, waiting, oldest] }) });

    expect(row?.artifact.artifactId).toBe('artifact-plan-2');
  });

  it('takes the newest plan when none waits for you', () => {
    const newest = {
      ...anArtifactRow({ id: 'artifact-plan-2', kind: 'plan', title: 'B' }),
      status: 'consumed',
    } as const;
    const oldest = {
      ...anArtifactRow({ id: 'artifact-plan-1', kind: 'plan', title: 'A' }),
      status: 'consumed',
    } as const;

    const row = dockPlanRowOf({ view: aView({ artifacts: [newest, oldest] }) });

    expect(row?.artifact.artifactId).toBe('artifact-plan-2');
  });

  it('ignores rows that are not plans and says null without a plan', () => {
    const report = anArtifactRow({ id: 'artifact-report', kind: 'report', title: 'R' });

    expect(dockPlanRowOf({ view: aView({ artifacts: [report] }) })).toBeNull();
    expect(dockPlanRowOf({ view: aView({ artifacts: [aPlanRow()] }) })?.title).toBe(
      'Retry-safe credit retries',
    );
  });
});
