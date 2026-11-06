type Params = Readonly<{
  count: number;
  isStuck: boolean;
}>;

export type WindowCloseCopy = Readonly<{
  title: string;
  description: string;
  confirmLabel: string;
}>;

export const windowCloseCopyOf = ({ count, isStuck }: Params): WindowCloseCopy => {
  const agents = count === 1 ? '1 agent' : `${count} agents`;
  if (isStuck) {
    return {
      title: `${agents} did not stop`,
      description:
        count === 1
          ? 'It is still running. Close anyway and it goes on without this window.'
          : 'They are still running. Close anyway and they go on without this window.',
      confirmLabel: 'Close anyway',
    };
  }
  return {
    title: `${agents} still working in this window`,
    description:
      count === 1
        ? 'Stop it to close the window. What it wrote is kept, and Continue picks it up.'
        : 'Stop them to close the window. What they wrote is kept, and Continue picks them up.',
    confirmLabel: `Stop ${agents}`,
  };
};
