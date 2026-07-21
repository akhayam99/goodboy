import { describe, it, expect, vi } from 'vitest';
import { buildSessionBreadcrumb } from './sessionBreadcrumb';
import type { SessionBreadcrumbHandlers, SessionBreadcrumbInput } from './sessionBreadcrumb';
import type { LensKind } from '../../../../store';

const makeHandlers = (): SessionBreadcrumbHandlers => ({
  toOverview: vi.fn(),
  toLens: vi.fn(),
  toWorkflowsList: vi.fn(),
  toPlansList: vi.fn(),
});

const lensLabel = (lens: LensKind) => lens;

const base = (
  overrides: Partial<SessionBreadcrumbInput>,
  handlers: SessionBreadcrumbHandlers,
): SessionBreadcrumbInput => ({
  lens: null,
  studio: null,
  selectedAgentName: null,
  overlayHomeLens: null,
  suppressAgentTail: false,
  focusedWorkflowName: null,
  focusedPlanTitle: null,
  lensLabel,
  handlers,
  ...overrides,
});

const labels = (crumbs: ReturnType<typeof buildSessionBreadcrumb>) => crumbs.map((c) => c.label);
const last = (crumbs: ReturnType<typeof buildSessionBreadcrumb>) => crumbs[crumbs.length - 1];

describe('buildSessionBreadcrumb', () => {
  it('renders a single non-clickable Overview crumb on bare overview', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({}, h));
    expect(labels(crumbs)).toEqual(['Overview']);
    expect(crumbs).toHaveLength(1);
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('renders Overview > lens for a leaf lens, Overview clickable', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ lens: 'questions' }, h));
    expect(labels(crumbs)).toEqual(['Overview', 'questions']);
    crumbs[0]!.onClick!();
    expect(h.toOverview).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('renders Overview > Workflows > {name} for a focused workflow run', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'workflows', focusedWorkflowName: 'refactor' }, h),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'Workflows', 'refactor']);
    crumbs[1]!.onClick!();
    expect(h.toWorkflowsList).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('renders Overview > Workflows > Create for the workflow builder studio', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ studio: { kind: 'workflow' } }, h));
    expect(labels(crumbs)).toEqual(['Overview', 'Workflows', 'Create']);
    crumbs[1]!.onClick!();
    expect(h.toWorkflowsList).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('renders Overview > {home} > {agent} for an agent overlay', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ selectedAgentName: 'scout-1', overlayHomeLens: 'agents' }, h),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'agents', 'scout-1']);
    crumbs[1]!.onClick!();
    expect(h.toLens).toHaveBeenCalledWith('agents');
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('routes the overlay-home crumb through toWorkflowsList when home is workflows', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ selectedAgentName: 'scout-1', overlayHomeLens: 'workflows' }, h),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'workflows', 'scout-1']);
    crumbs[1]!.onClick!();
    expect(h.toWorkflowsList).toHaveBeenCalledOnce();
    expect(h.toLens).not.toHaveBeenCalled();
  });

  it('suppresses the workflow agent tail when the workflow strip is present', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          selectedAgentName: 'scout-1',
          overlayHomeLens: 'workflows',
          suppressAgentTail: true,
        },
        h,
      ),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'Workflows']);
    expect(crumbs[0]?.onClick).toBeDefined();
    expect(crumbs[1]?.onClick).toBeDefined();
  });

  it('degrades a workflows lens with no focused run to a two-crumb leaf trail', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'workflows', focusedWorkflowName: null }, h),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'workflows']);
    expect(crumbs).toHaveLength(2);
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('renders PR #n for a github studio with a prNumber', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ studio: { kind: 'github', prNumber: 42 } }, h));
    expect(labels(crumbs)).toEqual(['Overview', 'pr', 'PR #42']);
    crumbs[1]!.onClick!();
    expect(h.toLens).toHaveBeenCalledWith('pr');
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('renders GitHub for a github studio without a prNumber', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ studio: { kind: 'github' } }, h));
    expect(labels(crumbs)).toEqual(['Overview', 'pr', 'GitHub']);
  });

  it('renders Merge request for an mr studio', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ studio: { kind: 'mr' } }, h));
    expect(labels(crumbs)).toEqual(['Overview', 'pr', 'Merge request']);
    crumbs[1]!.onClick!();
    expect(h.toLens).toHaveBeenCalledWith('pr');
  });

  it('renders Overview > Plans > {title} for a focused plan', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'plans', focusedPlanTitle: 'migration plan' }, h),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'Plans', 'migration plan']);
    crumbs[1]!.onClick!();
    expect(h.toPlansList).toHaveBeenCalledOnce();
  });

  it('lets the studio trail win over agent and workflow inputs', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          studio: { kind: 'workflow' },
          selectedAgentName: 'scout-1',
          overlayHomeLens: 'agents',
          lens: 'workflows',
          focusedWorkflowName: 'refactor',
        },
        h,
      ),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'Workflows', 'Create']);
  });
});
