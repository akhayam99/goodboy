import { describe, expect, it } from 'vitest';
import { createPrFailureText } from './createPrFailureText';

const OWNER_ERROR =
  "pull request create failed: GraphQL: Head sha can't be blank, Base sha can't be blank, No commits between origin/main and ak/cards, Base ref must be a branch (createPullRequest)";

describe('createPrFailureText', () => {
  it('says the base is missing from GitHub when GitHub refuses the base ref', () => {
    expect(createPrFailureText({ stderr: OWNER_ERROR, base: 'origin/main' })).toBe(
      "Couldn't open the pull request: the base branch origin/main isn't on GitHub. Pick a base that exists there and retry.",
    );
  });

  it('says the branch is missing from GitHub when only the head is blank', () => {
    expect(
      createPrFailureText({
        stderr:
          "pull request create failed: GraphQL: Head sha can't be blank, No commits between main and ak/cards (createPullRequest)",
        base: 'main',
      }),
    ).toBe("Couldn't open the pull request: the branch isn't on GitHub yet. Push it and retry.");
  });

  it('says the head must be a branch the same way', () => {
    expect(
      createPrFailureText({ stderr: 'GraphQL: Head ref must be a branch', base: 'main' }),
    ).toBe("Couldn't open the pull request: the branch isn't on GitHub yet. Push it and retry.");
  });

  it('says there is nothing to open when the branch adds no commit', () => {
    expect(
      createPrFailureText({
        stderr: 'pull request create failed: GraphQL: No commits between main and ak/cards',
        base: 'main',
      }),
    ).toBe(
      "Couldn't open the pull request: the branch has no commits that main lacks. Commit the work and retry.",
    );
  });

  it('names no base when none was sent', () => {
    expect(createPrFailureText({ stderr: 'Base ref must be a branch', base: undefined })).toBe(
      "Couldn't open the pull request: the base branch isn't on GitHub. Pick a base that exists there and retry.",
    );
  });

  it('keeps the host line for a refusal it does not know', () => {
    expect(
      createPrFailureText({ stderr: ' GraphQL: Resource not accessible \n', base: 'main' }),
    ).toBe('GraphQL: Resource not accessible');
  });
});
