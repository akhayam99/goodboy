import { describe, expect, it } from 'vitest';
import { mountActionFailureOf } from './mountActionFailure';

describe('mountActionFailureOf', () => {
  it.each([
    { actionId: 'mount.reopen', label: 'Reopen', title: "Couldn't reopen cascadia" },
    { actionId: 'mount.rebase', label: 'Rebase on main', title: "Couldn't rebase cascadia" },
    { actionId: 'mount.push', label: 'Push 2 commits', title: "Couldn't push cascadia" },
    {
      actionId: 'mount.createPullRequest',
      label: 'Create PR',
      title: "Couldn't create the pull request for cascadia",
    },
  ])('names the action and the project for $actionId', ({ actionId, label, title }) => {
    expect(
      mountActionFailureOf({ actionId, actionLabel: label, projectName: 'cascadia' }).title,
    ).toBe(title);
  });

  it('says what stayed as it was, in words', () => {
    const view = mountActionFailureOf({
      actionId: 'mount.reopen',
      actionLabel: 'Reopen',
      projectName: 'cascadia',
    });

    expect(view.body).toBe('The worktree stayed closed. Nothing else changed.');
  });

  it('falls back to the label of an action it has no copy for', () => {
    const view = mountActionFailureOf({
      actionId: 'mount.somethingNew',
      actionLabel: 'Sync remote',
      projectName: 'cascadia',
    });

    expect(view.title).toBe("Couldn't sync remote for cascadia");
    expect(view.body).toBe('Nothing changed.');
  });
});
