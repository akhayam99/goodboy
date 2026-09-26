import { describe, it, expect, vi } from 'vitest';
import { buildSessionBreadcrumb } from './sessionBreadcrumb';
import type { SessionBreadcrumbHandlers, SessionBreadcrumbInput } from './sessionBreadcrumb';
import type { LensKind } from '../../../../store';

const makeHandlers = (): SessionBreadcrumbHandlers => ({
  toOverview: vi.fn(),
  toLens: vi.fn(),
  toWorkflowsList: vi.fn(),
  toWorkflowRun: vi.fn(),
  toArtifactsList: vi.fn(),
  toParentAgent: vi.fn(),
  toRootAgent: vi.fn(),
  toReviewHome: vi.fn(),
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
  reviewModeLabel: null,
  lensLabel,
  handlers,
  ...overrides,
});

const labels = (crumbs: ReturnType<typeof buildSessionBreadcrumb>) => crumbs.map((c) => c.label);
const last = (crumbs: ReturnType<typeof buildSessionBreadcrumb>) => crumbs[crumbs.length - 1];

describe('buildSessionBreadcrumb', () => {
  it('carries the shown branch as the last crumb of the Diff', () => {
    const crumbs = buildSessionBreadcrumb(
      base(
        { lens: 'files', diffBranchLabel: 'ledger-core fix/ledger-reconcile-postings' },
        makeHandlers(),
      ),
    );
    expect(crumbs.map((crumb) => crumb.id)).toEqual(['overview', 'lens-files', 'diff-branch']);
    expect(last(crumbs)?.label).toBe('ledger-core fix/ledger-reconcile-postings');
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

  it('names the open review mode as a child of Review, which leads back home', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'review', reviewModeLabel: 'PR details' }, h),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'review', 'PR details']);
    crumbs[1]!.onClick!();
    expect(h.toReviewHome).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
  });

  it('keeps Review a leaf when the queue is showing', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ lens: 'review' }, h));
    expect(labels(crumbs)).toEqual(['Overview', 'review']);
  });

  it('extends the trail without dropping an ancestor when a child opens', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        { lens: 'agents', selectedChildHome: 'agents', selectedChildLabel: 'Selected agent' },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Overview', 'agents', 'Selected agent']);
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

    expect(labels(adHoc)).toEqual(['Overview', 'agents', 'scout one']);
    expect(labels(resolver)).toEqual(['Overview', 'review', 'Agent']);
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

    expect(labels(fromFeed)).toEqual(['Overview', 'Workflows', 'refactor', 'Implement']);
    expect(labels(fromAnotherLens)).toEqual(labels(fromFeed));
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

    expect(labels(crumbs)).toEqual(['Overview', 'Workflows', 'refactor', 'Implement']);
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

    expect(labels(crumbs)).toEqual([
      'Overview',
      'Workflows',
      'refactor',
      'Implement',
      'area alpha',
    ]);
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

    expect(labels(crumbs)).toEqual(['Overview', 'agents', 'scout one', 'scout area']);
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

    expect(labels(crumbs)).toEqual([
      'Overview',
      'Workflows',
      'refactor',
      'Implement',
      'mid',
      'leaf',
    ]);
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

    expect(labels(crumbs)).toEqual(['Overview', 'Workflows', 'refactor', 'Implement']);
  });

  it('keeps a workflow agent with no resolvable run under the workflows list', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base(
        { lens: 'workflows', selectedChildHome: 'workflows', selectedChildLabel: 'Implement' },
        h,
      ),
    );

    expect(labels(crumbs)).toEqual(['Overview', 'Workflows', 'Implement']);
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

    expect(labels(crumbs)).toEqual(['Overview', 'agents', 'scout one']);
  });

  it('renders Overview > Workflows > Create for the workflow builder studio', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ studio: { kind: 'workflow' } }, h));
    expect(labels(crumbs)).toEqual(['Overview', 'Workflows', 'Create']);
    crumbs[1]!.onClick!();
    expect(h.toWorkflowsList).toHaveBeenCalledOnce();
    expect(last(crumbs)?.onClick).toBeUndefined();
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

  it('roots the merge request studio in the GitLab lens, not the GitHub one', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ studio: { kind: 'mr' } }, h));
    expect(labels(crumbs)).toEqual(['Overview', 'gitlab_issues', 'Merge request']);
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
      expect(labels(crumbs)).toEqual(['Overview', lens]);
      expect(last(crumbs)?.onClick).toBeUndefined();
    }
  });

  it('opens on Overview so the session name never repeats the sidebar', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(base({ lens: 'agents' }, h));
    expect(crumbs[0]?.label).toBe('Overview');
  });

  it('renders Overview > Artifacts > {title} for a focused plan', () => {
    const h = makeHandlers();
    const crumbs = buildSessionBreadcrumb(
      base({ lens: 'plans', focusedArtifactTitle: 'migration plan' }, h),
    );
    expect(labels(crumbs)).toEqual(['Overview', 'Artifacts', 'migration plan']);
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
    expect(labels(crumbs)).toEqual(['Overview', 'Workflows', 'Create']);
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
      'Overview',
      'Workflows',
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

    expect(labels(crumbs)).toEqual(['Overview', 'agents', 'Answers', 'pick a database']);
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
    expect(labels(crumbs)).toEqual(['Overview', 'Artifacts', 'Create report']);
    expect(last(crumbs)?.onClick).toBeUndefined();
  });
});
