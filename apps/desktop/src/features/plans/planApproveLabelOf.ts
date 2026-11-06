type Params = Readonly<{
  nextStepName: string | null;
}>;

const LONGEST_STEP_NAME = 24;

export const planApproveLabelOf = ({ nextStepName }: Params): string =>
  nextStepName === null || nextStepName.length > LONGEST_STEP_NAME
    ? 'Approve and continue'
    : `Approve and start ${nextStepName}`;
