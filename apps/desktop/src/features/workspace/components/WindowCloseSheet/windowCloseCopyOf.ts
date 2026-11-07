type Params = Readonly<{
  count: number;
  runCount?: number;
  isStuck: boolean;
}>;

export type WindowCloseCopy = Readonly<{
  title: string;
  description: string;
  confirmLabel: string;
}>;

type LabelParams = Pick<Params, 'count'> &
  Readonly<{
    runCount: number;
  }>;

const workLabelOf = ({ count, runCount }: LabelParams): string => {
  const agents = count === 1 ? '1 agent' : `${count} agents`;
  const runs = runCount === 1 ? '1 run' : `${runCount} runs`;
  if (runCount === 0) {
    return agents;
  }
  return count === 0 ? runs : `${agents} and ${runs}`;
};

export const windowCloseCopyOf = ({ count, runCount = 0, isStuck }: Params): WindowCloseCopy => {
  const work = workLabelOf({ count, runCount });
  if (isStuck) {
    return {
      title: `${work} didn't stop`,
      description:
        count === 1
          ? 'It is still running. Close anyway and it goes on without this window.'
          : 'They are still running. Close anyway and they go on without this window.',
      confirmLabel: 'Close anyway',
    };
  }
  return {
    title: `${work} still working in this window`,
    description:
      count + runCount === 1
        ? 'Stop it to close. Its work stays. Continue picks it up.'
        : 'Stop them to close. Their work stays. Continue picks them up.',
    confirmLabel: `Stop ${work}`,
  };
};
