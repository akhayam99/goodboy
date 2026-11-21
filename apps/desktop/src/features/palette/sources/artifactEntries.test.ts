// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ArtifactId, ReportArtifact, SessionArtifact } from '@goodboy/types';
import {
  PLAN_FIXTURE_AT,
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
} from '../../../test/planFixtures';
import { artifactEntries } from './artifactEntries';

const REPORT_ID = 'report-ledger-drift' as ArtifactId;

const report: ReportArtifact = {
  id: REPORT_ID,
  sessionId: PLAN_FIXTURE_SESSION,
  agentId: PLAN_FIXTURE_PLANNER,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Ledger drift on Harborline',
  sourceFormat: 'markdown',
  sourceText: '# Ledger drift on Harborline',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: PLAN_FIXTURE_AT,
  updatedAt: PLAN_FIXTURE_AT,
  openedAt: null,
};

const artifacts: ReadonlyArray<SessionArtifact> = [report];

describe('artifact palette entries', () => {
  it('opens a plan and a report through the same opener', () => {
    const open = vi.fn();
    const entries = artifactEntries({
      sessionId: PLAN_FIXTURE_SESSION,
      plans: [aPlan()],
      artifacts,
      open,
    });

    const plan = entries.find((entry) => entry.tag === 'Plan');
    const other = entries.find((entry) => entry.tag === 'Report');
    plan?.run();
    other?.run();

    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenNthCalledWith(1, {
      sessionId: PLAN_FIXTURE_SESSION,
      artifactId: PLAN_FIXTURE_ID,
    });
    expect(open).toHaveBeenNthCalledWith(2, {
      sessionId: PLAN_FIXTURE_SESSION,
      artifactId: REPORT_ID,
    });
  });
});
