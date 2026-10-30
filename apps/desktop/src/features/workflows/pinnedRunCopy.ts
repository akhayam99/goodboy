type WarningParams = Readonly<{
  label: string;
  count: number;
}>;

const warning = ({ label, count }: WarningParams): string => {
  const named =
    count > 1
      ? `The run "${label}" and ${count - 1} more still write`
      : `The run "${label}" still writes`;
  return `${named} to this branch. If you detach it anyway, the run waits at its next step until you reattach it or pick another branch.`;
};

export const PINNED_RUN_COPY = {
  warning,
  detachAnyway: 'Detach anyway',
  stopRunFirst: 'Stop run first',
  stopRun: 'Stop run',
} as const;
