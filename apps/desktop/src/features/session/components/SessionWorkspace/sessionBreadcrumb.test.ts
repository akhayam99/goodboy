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
  overlayHomeLens: 'agents',
  suppressAgentTail: false,
  stripWorkflowName: null,
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

  it('replaces the workflow agent tail with the workflow name when the stepper is present', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          selectedAgentName: 'scout-1',
          overlayHomeLens: 'workflows',
          suppressAgentTail: true,
          stripWorkflowName: 'Release flow',
        },
        h,
      ),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'Workflows', 'Release flow']);
    expect(crumbs[0]?.onClick).toBeDefined();
    expect(crumbs[1]?.onClick).toBeDefined();
    expect(crumbs[2]?.onClick).toBeUndefined();
  });

  it('falls back to the workflow list when the stepper workflow name is unavailable', () => {
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

  it('never names the workflow while the resolve lens is active', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'resolve',
          selectedAgentName: 'resolve #12',
          overlayHomeLens: 'workflows',
          suppressAgentTail: true,
          stripWorkflowName: 'Release flow',
        },
        h,
      ),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'resolve', 'resolve #12']);
    crumbs[1]!.onClick!();
    expect(h.toLens).toHaveBeenCalledWith('resolve');
    expect(h.toWorkflowsList).not.toHaveBeenCalled();
  });

  it('never names the workflow while the agents lens is active', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'agents',
          selectedAgentName: 'scout-1',
          overlayHomeLens: 'workflows',
          stripWorkflowName: 'Release flow',
        },
        h,
      ),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'agents', 'scout-1']);
  });

  it('keeps the agent home when the active lens is not an agent list', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'pr', selectedAgentName: 'scout-1', overlayHomeLens: 'resolve' }, h),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'resolve', 'scout-1']);
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
