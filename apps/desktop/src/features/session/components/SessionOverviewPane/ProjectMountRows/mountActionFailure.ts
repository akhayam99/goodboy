type FailureCopy = {
  readonly verb: string;
  readonly body: string;
};

const FAILURE_COPY: Readonly<Record<string, FailureCopy>> = {
  'mount.reopen': { verb: 'reopen', body: 'The worktree stayed closed. Nothing else changed.' },
  'mount.rebase': { verb: 'rebase', body: 'The branch was not rebased.' },
  'mount.push': { verb: 'push', body: 'Nothing was pushed.' },
  'mount.createPullRequest': {
    verb: 'create the pull request for',
    body: 'No pull request was created.',
  },
};

type FailureParams = {
  readonly actionId: string;
  readonly actionLabel: string;
  readonly projectName: string;
};

export type MountActionFailureView = {
  readonly title: string;
  readonly body: string;
};

const lowerFirst = ({ text }: { readonly text: string }): string =>
  text.charAt(0).toLowerCase() + text.slice(1);

export const mountActionFailureOf = ({
  actionId,
  actionLabel,
  projectName,
}: FailureParams): MountActionFailureView => {
  const known = FAILURE_COPY[actionId];
  if (known !== undefined) {
    return { title: `Couldn't ${known.verb} ${projectName}`, body: known.body };
  }
  return {
    title: `Couldn't ${lowerFirst({ text: actionLabel })} for ${projectName}`,
    body: 'Nothing changed.',
  };
};
