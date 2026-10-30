type TitleParams = Readonly<{
  label: string;
  isAvailable: boolean;
}>;

const title = ({ label, isAvailable }: TitleParams): string =>
  isAvailable
    ? `This step writes to ${label}. A step keeps the branch the run started it on.`
    : `This step needs ${label}, which was detached from this session.`;

type BlockParams = Readonly<{
  stepNumber: number;
  branch: string | null;
}>;

const branchName = ({ branch }: Pick<BlockParams, 'branch'>): string =>
  branch === null ? 'the branch it started on' : branch;

export const RUN_STEP_PIN_COPY = {
  title,
  blockTitle: ({ stepNumber }: Pick<BlockParams, 'stepNumber'>): string =>
    `Step ${stepNumber} is waiting for a branch`,
  blockBody: ({ stepNumber, branch }: BlockParams): string =>
    `Step ${stepNumber} needs ${branchName({ branch })}, which was detached from this session.`,
  reattach: ({ branch }: Pick<BlockParams, 'branch'>): string =>
    branch === null ? 'Reattach' : `Reattach ${branch}`,
  use: ({ branch }: Pick<BlockParams, 'branch'>): string => `Use ${branch ?? 'another branch'}`,
  pick: 'Pick a branch',
  pickLabel: 'Branches in this session',
  failed: "Couldn't start the step",
} as const;
