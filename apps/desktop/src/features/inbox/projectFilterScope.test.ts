// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NO_INBOX_FILTERS, type InboxFilters } from './kindFilter';
import { projectFilterNote, projectFilterScope } from './projectFilterScope';
import type { InboxProvider } from './types';

type Case = {
  readonly name: string;
  readonly connected: ReadonlyArray<InboxProvider>;
  readonly filters?: Partial<InboxFilters>;
  readonly mapped: ReadonlyArray<InboxProvider>;
  readonly note: string | null;
};

const CASES: ReadonlyArray<Case> = [
  {
    name: 'Sentry alone',
    connected: ['sentry'],
    mapped: ['sentry'],
    note: null,
  },
  {
    name: 'Sentry and Linear',
    connected: ['linear', 'sentry'],
    mapped: ['sentry'],
    note: "Project filter applies to Sentry. Linear issues aren't tied to a project, so they stay listed.",
  },
  {
    name: 'Sentry, Linear and Jira',
    connected: ['linear', 'jira', 'sentry'],
    mapped: ['sentry'],
    note: "Project filter applies to Sentry. Linear and Jira issues aren't tied to a project, so they stay listed.",
  },
  {
    name: 'GitHub, Sentry and Slack',
    connected: ['github', 'sentry', 'slack'],
    mapped: ['github', 'sentry'],
    note: "Project filter applies to GitHub and Sentry. Slack threads aren't tied to a project, so they stay listed.",
  },
  {
    name: 'Sentry, Linear and Slack',
    connected: ['linear', 'sentry', 'slack'],
    mapped: ['sentry'],
    note: "Project filter applies to Sentry. Linear and Slack items aren't tied to a project, so they stay listed.",
  },
  {
    name: 'GitLab and GitHub',
    connected: ['github', 'gitlab'],
    mapped: ['github', 'gitlab'],
    note: null,
  },
  {
    name: 'Linear and Jira',
    connected: ['linear', 'jira'],
    mapped: [],
    note: null,
  },
  {
    name: 'Sentry connected but the Linear source picked',
    connected: ['linear', 'sentry'],
    filters: { source: 'linear' },
    mapped: [],
    note: null,
  },
  {
    name: 'the Errors type in a Sentry and Linear inbox',
    connected: ['linear', 'sentry'],
    filters: { kind: 'error' },
    mapped: ['sentry'],
    note: null,
  },
  {
    name: 'the Issues type in a GitHub, Linear and Sentry inbox',
    connected: ['github', 'linear', 'sentry'],
    filters: { kind: 'issue' },
    mapped: ['github'],
    note: "Project filter applies to GitHub. Linear issues aren't tied to a project, so they stay listed.",
  },
];

describe('projectFilterScope', () => {
  it.each(CASES)('scopes the project filter for $name', ({ connected, filters, mapped, note }) => {
    const scope = projectFilterScope({ connected, filters: { ...NO_INBOX_FILTERS, ...filters } });
    expect(scope.mapped).toEqual(mapped);
    expect(projectFilterNote({ scope })).toBe(note);
  });
});
