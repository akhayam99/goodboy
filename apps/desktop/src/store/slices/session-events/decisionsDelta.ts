type Params = {
  readonly previous: string;
  readonly next: string;
};

export type DecisionsDelta = {
  readonly added: number;
  readonly removed: number;
};

const REFORMULATION_THRESHOLD = 0.5;

const linesOf = ({ value }: { readonly value: string }): ReadonlyArray<string> =>
  value
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter((line) => line.length > 0);

const normalize = (line: string): string =>
  line
    .toLowerCase()
    .replace(/[.,;:!?'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const wordsOf = (line: string): ReadonlySet<string> =>
  new Set(
    normalize(line)
      .split(' ')
      .filter((word) => word.length > 0),
  );

const wordSimilarity = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) {
      shared += 1;
    }
  }
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
};

const hasSimilarLine = ({
  line,
  candidates,
}: {
  readonly line: string;
  readonly candidates: ReadonlyArray<string>;
}): boolean => {
  const lineWords = wordsOf(line);
  return candidates.some(
    (candidate) => wordSimilarity(lineWords, wordsOf(candidate)) >= REFORMULATION_THRESHOLD,
  );
};

export const decisionsDelta = ({ previous, next }: Params): DecisionsDelta => {
  const before = linesOf({ value: previous });
  const after = linesOf({ value: next });
  const beforeNormalized = new Set(before.map(normalize));
  const afterNormalized = new Set(after.map(normalize));

  const addedLines = after.filter((line) => !beforeNormalized.has(normalize(line)));
  const removedLines = before.filter((line) => !afterNormalized.has(normalize(line)));

  const added = addedLines.filter(
    (line) => !hasSimilarLine({ line, candidates: removedLines }),
  ).length;
  const removed = removedLines.filter(
    (line) => !hasSimilarLine({ line, candidates: addedLines }),
  ).length;

  return { added, removed };
};
