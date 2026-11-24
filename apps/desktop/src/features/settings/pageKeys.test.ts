import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKFLOW_RULES, type OverrideSettings } from '@goodboy/types';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import { FIELD_PAGE, isWorkspaceOwnedOverride, pageKeys } from './pageKeys';
import { PLAN_PAGES, WORKSPACE_PAGES } from './components/SettingsStudio/workspacePages';
import { fieldDef } from './workspaceSettings/fields';
import { copyPlan, restorePlan, type PlanScope } from './workspaceSettings/plan';
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

  it('puts each field on the page that holds its row', () => {
    expect(FIELD_PAGE).toEqual({
      parallelAgents: 'general',
      verbosity: 'general',
      workflowRules: 'general',
      branchPrefix: 'branches',
      branchTemplate: 'branches',
      afterMerge: 'branches',
      replyVoice: 'review-replies',
      replyStyleNote: 'review-replies',
      attribution: 'review-replies',
      replyTemplateFixed: 'review-replies',
      replyTemplateNoChange: 'review-replies',
      resolveOnGithub: 'review-replies',
      editPostedReply: 'review-replies',
      resolveCommitStyle: 'review-replies',
      permissionMode: 'general',
      roles: 'profile',
      aboutWork: 'profile',
      workingRules: 'profile',
      explainMore: 'profile',
    });
    expect(pageKeys({ page: 'branches' })).toEqual([
      'branchPrefix',
      'branchTemplate',
      'afterMerge',
    ]);
    expect(pageKeys({ page: 'general' })).not.toEqual(
      expect.arrayContaining(['branchPrefix', 'branchTemplate', 'attribution']),
    );
    expect(pageKeys({ page: 'review-replies' }).slice(0, 3)).toEqual([
      'replyVoice',
      'replyStyleNote',
      'attribution',
    ]);
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
      current: snapshot({ defaultVerbosity: 'brief', parallelAgents: false }),
    });

    expect(plan.flatMap((page) => page.items.map((item) => item.write))).toEqual([
      { overrides: { defaultVerbosity: null } },
    ]);
  });

  it('restores the branch names on Branches and the attribution line on Replies, not on Run defaults', () => {
    const current = snapshot({
      defaultBranchPrefix: 'hl',
      defaultBranchTemplate: '{prefix}/{task}-{slug}',
      attributionFooter: false,
      afterMerge: 'local-and-origin',
    });

    const fieldsOf = ({ scope }: { readonly scope: PlanScope }) =>
      restorePlan({ scope, current }).flatMap((page) => page.items.map((item) => item.field));

    expect(fieldsOf({ scope: 'general' })).toEqual([]);
    expect(fieldsOf({ scope: 'branches' })).toEqual([
      'branchPrefix',
      'branchTemplate',
      'afterMerge',
    ]);
    expect(fieldsOf({ scope: 'review-replies' })).toEqual(['attribution']);
  });

  it('copies the branch names into Branches and the attribution line into Replies', () => {
    const source = snapshot({
      defaultBranchPrefix: 'nw',
      attributionFooter: false,
      defaultVerbosity: 'brief',
    });
    const fieldsOf = ({ scope }: { readonly scope: PlanScope }) =>
      copyPlan({ scope, current: snapshot({}), source }).flatMap((page) =>
        page.items.map((item) => item.field),
      );

    expect(fieldsOf({ scope: 'general' })).toEqual(['verbosity']);
    expect(fieldsOf({ scope: 'branches' })).toEqual(['branchPrefix']);
    expect(fieldsOf({ scope: 'review-replies' })).toEqual(['attribution']);
    expect(
      copyPlan({ scope: 'all', current: snapshot({}), source }).map((page) => page.page),
    ).toEqual(['general', 'branches', 'review-replies']);
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

    expect(copy.map((page) => page.page)).toEqual(['general']);
    expect(copy[0]?.items.map((item) => [item.from, item.to, item.write])).toEqual([
      [
        'Every step · No limit · No guidance',
        'After the plan · $25 limit, pause · No guidance',
        { overrides: { workflowRules: rules } },
      ],
    ]);
    expect(restore[0]?.items.map((item) => item.write)).toEqual([
      { overrides: { workflowRules: null } },
    ]);
    expect(untouched).toEqual([]);
  });
});
