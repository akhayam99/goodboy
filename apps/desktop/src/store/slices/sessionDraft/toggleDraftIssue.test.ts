import { describe, expect, it } from 'vitest';
import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';
import { draftIssueKey } from './draftIssueKey';
import { removeDraftIssue } from './removeDraftIssue';
import { toggleDraftIssue } from './toggleDraftIssue';

const issue = (index: number): IssueCandidate => ({
  provider: 'linear',
  externalId: `issue-${index}`,
  identifier: `HL-${index}`,
  title: `Harborline issue ${index}`,
  url: `https://linear.app/harborline/issue/HL-${index}`,
  goal: '',
  body: '',
  branchSlug: `harborline-issue-${index}`,
});

describe('toggleDraftIssue', () => {
  it('adds an issue and removes it on the second toggle', () => {
    const added = toggleDraftIssue({ picked: [], candidate: issue(204) });
    expect(added).toEqual({ picked: [issue(204)], isRefused: false });

    const removed = toggleDraftIssue({ picked: added.picked, candidate: issue(204) });
    expect(removed).toEqual({ picked: [], isRefused: false });
  });

  it('keeps the order of the picks', () => {
    const first = toggleDraftIssue({ picked: [], candidate: issue(204) });
    const second = toggleDraftIssue({ picked: first.picked, candidate: issue(211) });

    expect(second.picked.map((entry) => entry.identifier)).toEqual(['HL-204', 'HL-211']);
  });

  it('refuses the sixth issue and leaves the five untouched', () => {
    const five = [1, 2, 3, 4, 5].map(issue);

    const result = toggleDraftIssue({ picked: five, candidate: issue(6) });

    expect(result.isRefused).toBe(true);
    expect(result.picked).toBe(five);
  });

  it('still removes one of five when the set is full', () => {
    const five = [1, 2, 3, 4, 5].map(issue);

    const result = toggleDraftIssue({ picked: five, candidate: issue(3) });

    expect(result.isRefused).toBe(false);
    expect(result.picked).toHaveLength(4);
  });
});

describe('removeDraftIssue', () => {
  it('promotes the second issue as branch namer when the first is removed', () => {
    const picked = [issue(204), issue(211), issue(212)];

    const rest = removeDraftIssue({ picked, key: draftIssueKey({ candidate: issue(204) }) });

    expect(rest.map((entry) => entry.identifier)).toEqual(['HL-211', 'HL-212']);
    expect(rest[0]?.identifier).toBe('HL-211');
  });

  it('ignores a key that is not picked', () => {
    const picked = [issue(204)];

    expect(removeDraftIssue({ picked, key: 'linear:none' })).toEqual(picked);
  });
});
