export type WordSegment = {
  readonly text: string;
  readonly isChanged: boolean;
};

export type WordDiff = {
  readonly before: ReadonlyArray<WordSegment>;
  readonly after: ReadonlyArray<WordSegment>;
};

const tokens = ({ text }: { readonly text: string }): ReadonlyArray<string> =>
  text.match(/\S+\s*|\s+/g) ?? [];

const sameToken = ({
  a,
  b,
}: {
  readonly a: string | undefined;
  readonly b: string | undefined;
}): boolean => a !== undefined && b !== undefined && a.trim() === b.trim();

const commonMatrix = ({
  left,
  right,
}: {
  readonly left: ReadonlyArray<string>;
  readonly right: ReadonlyArray<string>;
}): ReadonlyArray<ReadonlyArray<number>> => {
  const table = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      const row = table[i] ?? [];
      row[j] = sameToken({ a: left[i], b: right[j] })
        ? (table[i + 1]?.[j + 1] ?? 0) + 1
        : Math.max(table[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  return table;
};

const pushSegment = ({
  into,
  text,
  isChanged,
}: {
  readonly into: Array<WordSegment>;
  readonly text: string;
  readonly isChanged: boolean;
}): void => {
  const last = into.at(-1);
  if (last !== undefined && last.isChanged === isChanged) {
    into[into.length - 1] = { text: last.text + text, isChanged };
    return;
  }
  into.push({ text, isChanged });
};

const tidy = ({
  segments,
}: {
  readonly segments: ReadonlyArray<WordSegment>;
}): ReadonlyArray<WordSegment> => {
  const out: Array<WordSegment> = [];
  for (const segment of segments) {
    if (!segment.isChanged) {
      pushSegment({ into: out, text: segment.text, isChanged: false });
      continue;
    }
    const lead = segment.text.length - segment.text.trimStart().length;
    const core = segment.text.trim();
    if (core === '') {
      pushSegment({ into: out, text: segment.text, isChanged: false });
      continue;
    }
    pushSegment({ into: out, text: segment.text.slice(0, lead), isChanged: false });
    pushSegment({ into: out, text: core, isChanged: true });
    pushSegment({
      into: out,
      text: segment.text.slice(lead + core.length),
      isChanged: false,
    });
  }
  return out.filter((segment) => segment.text !== '');
};

export const wordDiff = ({
  before,
  after,
}: {
  readonly before: string;
  readonly after: string;
}): WordDiff => {
  const left = tokens({ text: before });
  const right = tokens({ text: after });
  const table = commonMatrix({ left, right });
  const removed: Array<WordSegment> = [];
  const added: Array<WordSegment> = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const from = left[i] ?? '';
    if (sameToken({ a: from, b: right[j] })) {
      pushSegment({ into: removed, text: from, isChanged: false });
      pushSegment({ into: added, text: right[j] ?? '', isChanged: false });
      i += 1;
      j += 1;
      continue;
    }
    if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      pushSegment({ into: removed, text: from, isChanged: true });
      i += 1;
      continue;
    }
    pushSegment({ into: added, text: right[j] ?? '', isChanged: true });
    j += 1;
  }
  for (; i < left.length; i += 1) {
    pushSegment({ into: removed, text: left[i] ?? '', isChanged: true });
  }
  for (; j < right.length; j += 1) {
    pushSegment({ into: added, text: right[j] ?? '', isChanged: true });
  }
  return { before: tidy({ segments: removed }), after: tidy({ segments: added }) };
};
