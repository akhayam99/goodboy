import { joinNouns } from '../../../auto/joinNouns';

type Params = {
  readonly numbers: ReadonlyArray<number>;
  readonly total: number | null;
};

const isContiguous = ({ numbers }: Pick<Params, 'numbers'>): boolean =>
  numbers.every((value, index) => index === 0 || value === (numbers[index - 1] ?? 0) + 1);

export const stepsLabelOf = ({ numbers, total }: Params): string => {
  const sorted = Array.from(new Set(numbers)).sort((first, second) => first - second);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const suffix = total === null ? '' : ` of ${total}`;
  if (first === undefined || last === undefined) {
    return total === null ? 'steps' : `${total} steps`;
  }
  if (sorted.length === 1) {
    return `step ${first}${suffix}`;
  }
  if (sorted.length === 2 && isContiguous({ numbers: sorted })) {
    return `steps ${first} and ${last}${suffix}`;
  }
  if (isContiguous({ numbers: sorted })) {
    return `steps ${first} to ${last}${suffix}`;
  }
  return `steps ${joinNouns({ nouns: sorted.map(String) })}${suffix}`;
};
