export type PullRequestSettings = Readonly<{
  isDraft: boolean;
  base: string | null;
}>;

const DEFAULTS: PullRequestSettings = { isDraft: true, base: null };

const OPENING =
  /^Write the title and body of a new pull request for \S+ into (\S+?)(, opened as a draft)?\.$/m;

export const pullRequestSettingsOfKickoff = ({
  kickoff,
}: {
  readonly kickoff: string | null;
}): PullRequestSettings => {
  if (kickoff === null) {
    return DEFAULTS;
  }
  const match = OPENING.exec(kickoff);
  if (match === null) {
    return DEFAULTS;
  }
  return { isDraft: match[2] !== undefined, base: match[1] ?? null };
};
