type Params = {
  readonly carriedTurns: number;
  readonly leftOutTurns: number;
  readonly isShortened: boolean;
  readonly hasPlan: boolean;
  readonly noteCount: number;
};

type CountParams = {
  readonly count: number;
  readonly noun: string;
};

const countOf = ({ count, noun }: CountParams): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

export const handoffNoticeMessage = ({
  carriedTurns,
  leftOutTurns,
  isShortened,
  hasPlan,
  noteCount,
}: Params): string | null => {
  if (leftOutTurns === 0 && !isShortened) {
    return null;
  }
  const carried = [
    ...(carriedTurns > 0 ? [countOf({ count: carriedTurns, noun: 'turn' })] : []),
    ...(hasPlan ? ['the plan'] : []),
    ...(noteCount > 0 ? [countOf({ count: noteCount, noun: 'note' })] : []),
  ];
  const left = [
    ...(leftOutTurns > 0 ? [countOf({ count: leftOutTurns, noun: 'older turn' })] : []),
    ...(isShortened ? ['part of the longest message'] : []),
  ];
  const carriedText = carried.length > 0 ? carried.join(', ') : 'nothing from the history';
  return `Carried over: ${carriedText}; left out: ${left.join(', ')}.`;
};
