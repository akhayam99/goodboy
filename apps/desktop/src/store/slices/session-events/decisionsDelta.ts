type Params = {
  readonly previous: string;
  readonly next: string;
};

export type DecisionsDelta = {
  readonly added: number;
  readonly removed: number;
};

const linesOf = ({ value }: { readonly value: string }): ReadonlyArray<string> =>
  value
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter((line) => line.length > 0);

export const decisionsDelta = ({ previous, next }: Params): DecisionsDelta => {
  const before = linesOf({ value: previous });
  const after = linesOf({ value: next });
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((line) => !beforeSet.has(line)).length,
    removed: before.filter((line) => !afterSet.has(line)).length,
  };
};
