// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { buildSessionBreadcrumb } from './sessionBreadcrumb';
import type { SessionBreadcrumbHandlers, SessionBreadcrumbInput } from './sessionBreadcrumb';
import type { LensKind } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

const makeHandlers = (): SessionBreadcrumbHandlers => ({
  toOverview: vi.fn(),
  toLens: vi.fn(),
  toWorkflowsList: vi.fn(),
  toWorkflowRun: vi.fn(),
  toArtifactsList: vi.fn(),
  toParentAgent: vi.fn(),
  toRootAgent: vi.fn(),
  toPullRequestHome: vi.fn(),
});

const lensLabel = (lens: LensKind) => lens;

const base = (
  overrides: Partial<SessionBreadcrumbInput>,
  handlers: SessionBreadcrumbHandlers,
): SessionBreadcrumbInput => ({
  lens: null,
  studio: null,
  focusedWorkflowName: null,
  selectedChildWorkflowName: null,
  focusedArtifactTitle: null,
  artifactCreationLabel: null,
  selectedChildLabel: null,
  selectedChildHome: null,
  selectedParentLabel: null,
  selectedRootLabel: null,
  selectedQuestionLabel: null,
  pullRequestModeLabel: null,
  lensLabel,
  handlers,
  ...overrides,
});

const labels = (crumbs: ReturnType<typeof buildSessionBreadcrumb>) => crumbs.map((c) => c.label);
const last = (crumbs: ReturnType<typeof buildSessionBreadcrumb>) => crumbs[crumbs.length - 1];

describe('buildSessionBreadcrumb', () => {
  it('names a resolver run Fix run under its lens', () => {
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          selectedChildHome: 'review',
          selectedChildLabel: 'resolve: ana on retryPolicy.ts:42',
        },
        makeHandlers(),
      ),
    );
    expect(labels(crumbs)).toEqual(['Session', 'review', 'Fix run']);
  });

  it('ends the trail on the Branch when no thread, file or page is open', () => {
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'branch', branch: { label: '#318 Ledger export', leaf: null } }, makeHandlers()),
    );
    expect(crumbs.map((crumb) => crumb.id)).toEqual(['overview', 'branch']);
    expect(last(crumbs)?.label).toBe('#318 Ledger export');
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('puts the open thread under the Branch and leads back to it from the Branch crumb', () => {
    const toBranch = vi.fn();
    const leaf = { id: 'review-thread', label: 'page.tsx:21', icon: CONCEPT_ICONS.comments };
    const crumbs = buildSessionBreadcrumb(
      base(
        { lens: 'branch', branch: { label: '#318 Ledger export', leaf } },
        { ...makeHandlers(), toBranch },
      ),
    );
    expect(crumbs.map((crumb) => crumb.id)).toEqual(['overview', 'branch', 'review-thread']);
    crumbs[1]?.onClick?.();
    expect(toBranch).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('hangs the Fix run directly under the Branch', () => {
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          selectedChildHome: 'review',
          selectedChildLabel: 'resolve: ana on page.tsx:21',
          branch: { label: '#318 Ledger export', leaf: null },
        },
        makeHandlers(),
      ),
    );
    expect(crumbs.map((crumb) => crumb.id)).toEqual(['overview', 'branch', 'selected-child']);
    expect(last(crumbs)?.label).toBe('Fix run');
  });

  it('gives every crumb of a deep trail an icon, and agents their kind colour', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'workflows',
          selectedChildHome: 'workflows',
          selectedChildWorkflowName: 'Ship webhook retries',
          selectedChildLabel: 'Wire checkout errors',
          selectedChildTone: 'text-agent-implementer',
          selectedParentLabel: 'implementer',
          selectedQuestionLabel: 'Which retry policy?',
        },
        h,
      ),
    );

    expect(crumbs.every((crumb) => crumb.icon != null)).toBe(true);
    expect(crumbs.find((crumb) => crumb.id === 'delegated-answers')).toBeDefined();
    expect(
      buildSessionBreadcrumb(
        base(
          {
            selectedChildHome: 'agents',
            selectedChildLabel: 'scout one',
            selectedChildTone: 'text-agent-scout',
          },
          h,
        ),
      ).at(-1)?.iconClassName,
    ).toBe('text-agent-scout');
  });

  it('renders a single non-clickable Overview crumb on bare overview', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({}, h));
    expect(labels(crumbs)).toEqual(['Session']);
    expect(crumbs).toHaveLength(1);
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('renders Overview > lens for a leaf lens, Overview clickable', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ lens: 'questions' }, h));
    expect(labels(crumbs)).toEqual(['Session', 'questions']);
    crumbs[0]!.onClick!();
    expect(h.toOverview).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('puts Write review under the pull request, which leads back to its page', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'pr', pullRequestNumber: 528, pullRequestModeLabel: 'Write review' }, h),
    );
    expect(labels(crumbs)).toEqual(['Session', 'pr', '#528', 'Write review']);
    crumbs[2]!.onClick!();
    expect(h.toPullRequestHome).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('names the new pull request form under a pull request with no number', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ lens: 'pr', pullRequestModeLabel: 'New' }, h));
    expect(labels(crumbs)).toEqual(['Session', 'pr', 'New']);
  });

  it('keeps the pull request a leaf on its own page', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ lens: 'pr', pullRequestNumber: 528 }, h));
    expect(labels(crumbs)).toEqual(['Session', 'pr', '#528']);
  });

  it('keeps Review a leaf when the queue is showing', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ lens: 'review' }, h));
    expect(labels(crumbs)).toEqual(['Session', 'review']);
  });

  it('extends the trail without dropping an ancestor when a child opens', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        { lens: 'agents', selectedChildHome: 'agents', selectedChildLabel: 'Selected agent' },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Session', 'agents', 'Selected agent']);
    crumbs[1]!.onClick!();
    expect(h.toLens).toHaveBeenCalledWith('agents');
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('parents a child on its own home when a shortcut left the lens on overview', () => {
    const h = makeHandlers();
    const adHoc = buildSessionBreadcrumb(
      base({ lens: null, selectedChildHome: 'agents', selectedChildLabel: 'scout one' }, h),
    );
    const resolver = buildSessionBreadcrumb(
      base({ lens: null, selectedChildHome: 'review', selectedChildLabel: 'review one' }, h),
    );

    expect(labels(adHoc)).toEqual(['Session', 'agents', 'scout one']);
    expect(labels(resolver)).toEqual(['Session', 'review', 'Fix run']);
  });

  it('parents a step on its run no matter which lens the jump came from', () => {
    const h = makeHandlers();
    const fromFeed = buildSessionBreadcrumb(
      base(
        {
          lens: null,
          selectedChildHome: 'workflows',
          selectedChildWorkflowName: 'refactor',
          selectedChildLabel: 'Implement',
        },
        h,
      ),
    );
    const fromAnotherLens = buildSessionBreadcrumb(
      base(
        {
          lens: 'review',
          selectedChildHome: 'workflows',
          selectedChildWorkflowName: 'refactor',
          selectedChildLabel: 'Implement',
        },
        h,
      ),
    );

    expect(labels(fromFeed)).toEqual(['Session', 'Runs', 'refactor', 'Implement']);
    expect(labels(fromAnotherLens)).toEqual(labels(fromFeed));
  });

  it('renders Overview > Workflows > {name} for a focused workflow run', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'workflows', focusedWorkflowName: 'refactor' }, h),
    );
    expect(labels(crumbs)).toEqual(['Session', 'Runs', 'refactor']);
    crumbs[1]!.onClick!();
    expect(h.toWorkflowsList).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('gives a workflow step the same four-level trail, run crumb included', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'workflows',
          selectedChildHome: 'workflows',
          selectedChildWorkflowName: 'refactor',
          selectedChildLabel: 'Implement',
        },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Session', 'Runs', 'refactor', 'Implement']);
    expect(last(crumbs)?.id).toBe('selected-child');
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('slots the father between the run and the cluster child', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'workflows',
          selectedChildHome: 'workflows',
          selectedChildWorkflowName: 'refactor',
          selectedChildLabel: 'area alpha',
          selectedParentLabel: 'Implement',
        },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Session', 'Runs', 'refactor', 'Implement', 'area alpha']);
    expect(crumbs[3]?.id).toBe('selected-parent');
    crumbs[3]!.onClick!();
    expect(h.toParentAgent).toHaveBeenCalledOnce();
    expect(last(crumbs)?.id).toBe('selected-child');
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('keeps the father crumb on a non-workflow home too', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: null,
          selectedChildHome: 'agents',
          selectedChildLabel: 'scout area',
          selectedParentLabel: 'scout one',
        },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Session', 'agents', 'scout one', 'scout area']);
    crumbs[2]!.onClick!();
    expect(h.toParentAgent).toHaveBeenCalledOnce();
  });

  it('collapses a deeper chain to root, father, and child without crashing', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'workflows',
          selectedChildHome: 'workflows',
          selectedChildWorkflowName: 'refactor',
          selectedChildLabel: 'leaf',
          selectedParentLabel: 'mid',
          selectedRootLabel: 'Implement',
        },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Session', 'Runs', 'refactor', 'Implement', 'mid', 'leaf']);
    expect(crumbs[3]?.id).toBe('selected-root');
    crumbs[3]!.onClick!();
    expect(h.toRootAgent).toHaveBeenCalledOnce();
  });

  it('navigates to the run from the third crumb of a step trail', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'workflows',
          selectedChildHome: 'workflows',
          selectedChildWorkflowName: 'refactor',
          selectedChildLabel: 'Implement',
        },
        h,
      ),
    );

    crumbs[2]!.onClick!();
    expect(h.toWorkflowRun).toHaveBeenCalledOnce();
    crumbs[1]!.onClick!();
    expect(h.toWorkflowsList).toHaveBeenCalledOnce();
  });

  it('prefers the run of the open step over whichever run is merely focused', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'workflows',
          selectedChildHome: 'workflows',
          focusedWorkflowName: 'release',
          selectedChildWorkflowName: 'refactor',
          selectedChildLabel: 'Implement',
        },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Session', 'Runs', 'refactor', 'Implement']);
  });

  it('keeps a workflow agent with no resolvable run under the workflows list', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        { lens: 'workflows', selectedChildHome: 'workflows', selectedChildLabel: 'Implement' },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Session', 'Runs', 'Implement']);
    crumbs[1]!.onClick!();
    expect(h.toWorkflowsList).toHaveBeenCalledOnce();
  });

  it('shows the open child rather than the plan the lens still has focused', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'plans',
          focusedArtifactTitle: 'migration plan',
          selectedChildHome: 'agents',
          selectedChildLabel: 'scout one',
        },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Session', 'agents', 'scout one']);
  });

  it('renders Overview > Workflows > Create for the workflow builder studio', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ studio: { kind: 'workflow' } }, h));
    expect(labels(crumbs)).toEqual(['Session', 'Runs', 'Create']);
    crumbs[1]!.onClick!();
    expect(h.toWorkflowsList).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('degrades a workflows lens with no focused run to a two-crumb leaf trail', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'workflows', focusedWorkflowName: null }, h),
    );
    expect(labels(crumbs)).toEqual(['Session', 'workflows']);
    expect(crumbs).toHaveLength(2);
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('roots the merge request studio in the GitLab lens, not the GitHub one', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ studio: { kind: 'mr' } }, h));
    expect(labels(crumbs)).toEqual(['Session', 'gitlab_issues', 'Merge request']);
    crumbs[1]!.onClick!();
    expect(h.toLens).toHaveBeenCalledWith('gitlab_issues');
  });

  it('gives every integration lens the same two-crumb depth', () => {
    const h = makeHandlers();
    const lenses: ReadonlyArray<LensKind> = [
      'pr',
      'gitlab_issues',
      'jira_issues',
      'linear',
      'slack_threads',
    ];

    for (const lens of lenses) {
      const crumbs = buildSessionBreadcrumb(base({ lens }, h));
      expect(labels(crumbs)).toEqual(['Session', lens]);
      expect(last(crumbs)?.onClick).toBeUndefined();
    }
  });

  it('opens on Overview so the session name never repeats the sidebar', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ lens: 'agents' }, h));
    expect(crumbs[0]?.label).toBe('Session');
  });

  it('renders Overview > Artifacts > {title} for a focused plan', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'plans', focusedArtifactTitle: 'migration plan' }, h),
    );
    expect(labels(crumbs)).toEqual(['Session', 'Artifacts', 'migration plan']);
    crumbs[1]!.onClick!();
    expect(h.toArtifactsList).toHaveBeenCalledOnce();
  });

  it('lets the studio trail win over the active workflow detail', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          studio: { kind: 'workflow' },
          lens: 'workflows',
          focusedWorkflowName: 'refactor',
        },
        h,
      ),
    );
    expect(labels(crumbs)).toEqual(['Session', 'Runs', 'Create']);
  });

  it('names the delegate step Answers instead of repeating the question', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'workflows',
          selectedChildHome: 'workflows',
          selectedChildWorkflowName: 'refactor',
          selectedParentLabel: 'Implement',
          selectedChildLabel: 'answer: pick a database',
          selectedQuestionLabel: 'pick a database',
        },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual([
      'Session',
      'Runs',
      'refactor',
      'Implement',
      'Answers',
      'pick a database',
    ]);
    expect(crumbs[4]?.onClick).toBeUndefined();
    expect(last(crumbs)?.id).toBe('selected-question');
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('carries the question crumb on a non-workflow home too', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'agents',
          selectedChildHome: 'agents',
          selectedChildLabel: 'answer: pick a database',
          selectedQuestionLabel: 'pick a database',
        },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Session', 'agents', 'Answers', 'pick a database']);
    expect(last(crumbs)?.id).toBe('selected-question');
  });

  it('leaves the trail ending on the agent when no question is in view', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'agents',
          selectedChildHome: 'agents',
          selectedChildLabel: 'scout one',
        },
        h,
      ),
    );

    expect(last(crumbs)?.id).toBe('selected-child');
  });

  it('renders Overview > Artifacts > Create report while creation is open', () => {
    const handlers = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        {
          lens: 'plans',
          artifactCreationLabel: 'Create report',
          focusedArtifactTitle: 'Round once',
        },
        handlers,
      ),
    );
    expect(labels(crumbs)).toEqual(['Session', 'Artifacts', 'Create report']);
    expect(last(crumbs)?.onClick).toBeUndefined();
  });
});
