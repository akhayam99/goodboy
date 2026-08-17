import { describe, expect, it } from 'vitest';
import { buildLensNavigation } from './groups';

const BASE = {
  isBranchless: false,
  isPrReview: false,
  reviewDraftCount: 0,
  activeWorkflows: 0,
  attentionLens: null,
  unreadLens: null,
  agentCount: 0,
  areAgentsLoading: false,
  hasRunningAgent: false,
  openResolvers: 0,
  hasPendingBatch: false,
  openCount: 0,
  areQuestionsLoading: false,
  filesCount: 0,
  activePlans: 0,
  arePlansLoading: false,
  areWorkflowsLoading: false,
  areReviewDraftsLoading: false,
  areFilesLoading: false,
  runningScripts: 0,
  liveTerminals: 0,
  integrationRows: [],
};

describe('buildLensNavigation', () => {
  it('keeps every group mounted and labelled when every count is zero', () => {
    const { primaryRows, groups } = buildLensNavigation(BASE);

    expect(primaryRows.map((row) => row.kind)).toEqual(['context']);
    expect(groups.map((group) => group.label)).toEqual(['Work', 'Infra', 'Integrations']);
  });

  it('gives every group a label so no group is keyed on an empty string', () => {
    const { groups } = buildLensNavigation(BASE);

    expect(groups.every((group) => group.label.length > 0)).toBe(true);
  });

  it('keeps the Integrations group without relying on its label', () => {
    const { groups } = buildLensNavigation({ ...BASE, integrationRows: [] });
    const integrations = groups.find((group) => group.label === 'Integrations');

    expect(integrations).toBeDefined();
    expect(integrations?.rows).toEqual([]);
  });

  it('drops repo-only destinations on a branchless session as a capability, not a count', () => {
    const { primaryRows, groups } = buildLensNavigation({ ...BASE, isBranchless: true });

    expect(groups.map((group) => group.label)).toEqual(['Work']);
    expect(primaryRows.some((row) => row.repoOnly === true)).toBe(false);
    expect(groups.flatMap((group) => group.rows).some((row) => row.repoOnly === true)).toBe(false);
    expect(groups.flatMap((group) => group.rows).map((row) => row.kind)).toContain('explore');
  });

  it('marks a row as count-loading rather than removing it', () => {
    const { groups } = buildLensNavigation({ ...BASE, areWorkflowsLoading: true });
    const workflows = groups.flatMap((group) => group.rows).find((row) => row.kind === 'workflows');

    expect(workflows?.isCountLoading).toBe(true);
  });
});
