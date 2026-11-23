export type MountCard = Readonly<{
  title: string;
  line: string;
  label: string;
  busyLabel: string;
  message: string;
  doneLine: string;
}>;

type Params = {
  readonly project: string;
  readonly branch: string | null;
  readonly baseBranch: string | null;
};

export const mountCardOf = ({ project, branch, baseBranch }: Params): MountCard => {
  const base = baseBranch ?? 'main';
  const onBranch = branch === null ? '' : ` on ${branch}`;
  return {
    title: `To do this, mount ${project}`,
    line:
      branch === null
        ? `A branch starts from ${base}.`
        : `A branch on ${branch} starts from ${base}.`,
    label: `Mount ${project}`,
    busyLabel: `Mounting ${project}`,
    message: `Mounted ${project}${onBranch}. Go on with my request.`,
    doneLine: `Mounted ${project}${onBranch}`,
  };
};
