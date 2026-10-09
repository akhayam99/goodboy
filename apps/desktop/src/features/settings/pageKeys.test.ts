import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKFLOW_RULES, type OverrideSettings } from '@goodboy/types';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import { FIELD_PAGE, isWorkspaceOwnedOverride, pageKeys } from './pageKeys';
import { PLAN_PAGES, WORKSPACE_PAGES } from './components/SettingsStudio/workspacePages';
import { fieldDef } from './workspaceSettings/fields';
import { copyPlan, restorePlan } from './workspaceSettings/plan';
import type { WorkspaceSettingsSnapshot } from './workspaceSettings/snapshot';

const snapshot = (overrides: Partial<OverrideSettings>): WorkspaceSettingsSnapshot => ({
  overrides: { ...EMPTY_OVERRIDES, ...overrides },
  profile: { roles: [], aboutWork: null, workingRules: null, explainMore: [] },
  permissionMode: null,
  editPostedReply: null,
});

describe('pageKeys', () => {
  it('gives every stored override key a workspace field or the provider defaults', () => {
    const owned = Object.keys(EMPTY_OVERRIDES).filter(isWorkspaceOwnedOverride);
    const providers = Object.keys(EMPTY_OVERRIDES).filter((key) => !isWorkspaceOwnedOverride(key));

    expect(owned).toHaveLength(13);
    expect(providers.sort()).toEqual([
      'defaultProviderId',
      'providerBindings',
      'providerPool',
      'roleModels',
      'taskModels',
    ]);
    expect(isWorkspaceOwnedOverride('bootstrap.phase.ledger-core')).toBe(false);
  });

  it('puts every field on exactly one workspace page', () => {
    const owned = PLAN_PAGES.flatMap((page) => pageKeys({ page }));

    expect([...owned].sort()).toEqual(Object.keys(FIELD_PAGE).sort());
    expect(new Set(owned).size).toBe(owned.length);
    Object.keys(FIELD_PAGE).forEach((field) => {
      expect(fieldDef({ field: field as keyof typeof FIELD_PAGE }).page).toBe(
        FIELD_PAGE[field as keyof typeof FIELD_PAGE],
      );
    });
  });

  it('keeps the replies page id and names the page after what it holds', () => {
    const page = WORKSPACE_PAGES.find((entry) => entry.id === 'review-replies');

    expect(page?.label).toBe('Replies and commits');
    expect(pageKeys({ page: 'review-replies' })).toEqual(
      expect.arrayContaining(['replyVoice', 'resolveCommitStyle', 'resolveOnGithub']),
    );
    expect(WORKSPACE_PAGES.map((entry) => entry.label)).not.toContain('Review replies');
  });

  it('owns nothing on Projects, so it is never copied', () => {
    expect(pageKeys({ page: 'projects' })).toEqual([]);
  });

  it('writes each workspace override key from exactly one field', () => {
    const written = (Object.keys(FIELD_PAGE) as ReadonlyArray<keyof typeof FIELD_PAGE>).flatMap(
      (field) => Object.keys(fieldDef({ field }).write(null).overrides ?? {}),
    );

    expect([...written].sort()).toEqual(
      Object.keys(EMPTY_OVERRIDES).filter(isWorkspaceOwnedOverride).sort(),
    );
  });
});

describe('workspace settings plans', () => {
  it('restores by writing null for every changed value', () => {
    const plan = restorePlan({
      scope: 'general',
      current: snapshot({ defaultBranchPrefix: 'hl', parallelAgents: false }),
    });

    expect(plan.flatMap((page) => page.items.map((item) => item.write))).toEqual([
      { overrides: { defaultBranchPrefix: null } },
    ]);
  });

  it('never copies provider defaults or a value the source leaves at its default', () => {
    const plan = copyPlan({
      scope: 'all',
      current: snapshot({ defaultBranchPrefix: 'hl' }),
      source: snapshot({
        defaultProviderId: 'codex',
        roleModels: {},
        providerPool: null,
        defaultVerbosity: 'brief',
      }),
    });

    expect(plan.map((page) => page.page)).toEqual(['general']);
    expect(plan[0]?.items.map((item) => item.field)).toEqual(['verbosity']);
  });

  it('carries the workflow rules in all pages as one value and restores them to the defaults', () => {
    const rules = { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' as const, spendLimitUsd: 25 };
    const copy = copyPlan({
      scope: 'all',
      current: snapshot({}),
      source: snapshot({ workflowRules: rules }),
    });
    const restore = restorePlan({
      scope: 'all',
      current: snapshot({ workflowRules: rules }),
    });
    const untouched = restorePlan({
      scope: 'all',
      current: snapshot({ workflowRules: DEFAULT_WORKFLOW_RULES }),
    });

    expect(copy.map((page) => page.page)).toEqual(['workflow-rules']);
    expect(copy[0]?.items.map((item) => [item.from, item.to, item.write])).toEqual([
      [
        'Ask before each step · No spend cap · No guidance',
        'Ask after the plan · $25 cap, pause · No guidance',
        { overrides: { workflowRules: rules } },
      ],
    ]);
    expect(restore[0]?.items.map((item) => item.write)).toEqual([
      { overrides: { workflowRules: null } },
    ]);
    expect(untouched).toEqual([]);
  });
});
