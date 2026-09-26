import type { LensKind } from '../session-view/types';
import type { Place, SessionTarget, SessionView } from './types';

const LENS_ADDRESS: Record<LensKind, string> = {
  questions: 'questions',
  agents: 'agents',
  workflows: 'workflows',
  review: 'review',
  plans: 'artifacts',
  scripts: 'scripts',
  terminal: 'terminal',
  context: 'context',
  goal: 'context/goal',
  decisions: 'context/decisions',
  last_output_summary: 'context/summary',
  pr: 'pr',
  files: 'diff',
  explore: 'explore',
  linear: 'linear',
  gitlab_issues: 'gitlab',
  jira_issues: 'jira',
  github_issue: 'github-issue',
  slack_threads: 'slack',
};

type TargetParams = {
  readonly target: SessionTarget;
};

const targetAddress = ({ target }: TargetParams): string => {
  switch (target.kind) {
    case 'artifact':
      return target.artifactId;
    case 'run':
      return target.runId;
    case 'github-issue':
      return String(target.issueNumber);
    case 'external-task':
      return target.task.externalId;
    case 'diff': {
      const mount = target.mountPath ?? '';
      const focus = target.focus === null ? '' : `@${target.focus.kind}`;
      const sha = target.focus?.kind === 'commit' ? `:${target.focus.sha}` : '';
      const path = target.focus?.path == null ? '' : `#${target.focus.path}`;
      return `${mount}${focus}${sha}${path}`;
    }
    case 'terminal':
      return target.mountPath;
    default: {
      const unreachable: never = target;
      return unreachable;
    }
  }
};

type ViewParams = {
  readonly view: SessionView;
};

const sessionViewAddress = ({ view }: ViewParams): string => {
  const parts: Array<string> = [];
  if (view.lens !== null) {
    parts.push(LENS_ADDRESS[view.lens]);
  }
  if (view.target !== null) {
    parts.push(targetAddress({ target: view.target }));
  }
  if (view.agentId !== null) {
    parts.push('agent', view.agentId);
  }
  if (view.studio !== null) {
    parts.push(view.studio.kind === 'workflow' ? 'edit' : view.studio.kind);
  }
  return parts.join('/');
};

type Params = {
  readonly place: Place;
};

export const locationKey = ({ place }: Params): string => {
  if (place.at === 'board') {
    return 'board';
  }
  const view = sessionViewAddress({ view: place.view });
  return view === '' ? `s/${place.sessionId}` : `s/${place.sessionId}/${view}`;
};
