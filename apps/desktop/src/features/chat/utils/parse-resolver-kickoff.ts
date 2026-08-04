import { RESOLVER_KICKOFF_LABELS as LABELS } from './resolverKickoffLabels';

export type ResolverKickoffThread = {
  readonly position: number;
  readonly total: number;
  readonly threadId: string | null;
  readonly author: string | null;
  readonly location: string | null;
  readonly link: string | null;
  readonly body: string;
  readonly replies: ReadonlyArray<{ readonly author: string; readonly body: string }>;
};

export type ParsedResolverKickoff = {
  readonly headline: string;
  readonly threads: ReadonlyArray<ResolverKickoffThread>;
};

const SECTION_LABELS: ReadonlyArray<string> = [
  LABELS.instructions,
  LABELS.reporting,
  LABELS.replyContract,
  LABELS.operatorNotes,
];

const unquote = ({ lines }: { readonly lines: ReadonlyArray<string> }): string =>
  lines
    .map((line) => (line === LABELS.quote ? '' : line.slice(LABELS.quote.length + 1)))
    .join('\n')
    .trim();

const valueAfter = ({
  lines,
  prefix,
}: {
  readonly lines: ReadonlyArray<string>;
  readonly prefix: string;
}): string | null => {
  const found = lines.find((line) => line.startsWith(prefix));
  if (found === undefined) {
    return null;
  }
  const value = found.slice(prefix.length).trim();
  return value === '' ? null : value;
};

const quotedRun = ({
  lines,
  from,
}: {
  readonly lines: ReadonlyArray<string>;
  readonly from: number;
}): ReadonlyArray<string> => {
  const collected: Array<string> = [];
  for (let index = from; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!line.startsWith(LABELS.quote)) {
      break;
    }
    collected.push(line);
  }
  return collected;
};

const parseThread = ({
  lines,
  position,
  total,
}: {
  readonly lines: ReadonlyArray<string>;
  readonly position: number;
  readonly total: number;
}): ResolverKickoffThread => {
  const commentAt = lines.indexOf(LABELS.comment);
  const body =
    commentAt === -1 ? '' : unquote({ lines: quotedRun({ lines, from: commentAt + 1 }) });
  const replies: Array<{ author: string; body: string }> = [];
  for (const [index, line] of lines.entries()) {
    const match = LABELS.replyFrom.exec(line);
    if (match === null) {
      continue;
    }
    replies.push({
      author: match[1] ?? '',
      body: unquote({ lines: quotedRun({ lines, from: index + 1 }) }),
    });
  }
  return {
    position,
    total,
    threadId: valueAfter({ lines, prefix: LABELS.threadId }),
    author: valueAfter({ lines, prefix: LABELS.author }),
    location: valueAfter({ lines, prefix: LABELS.location }),
    link: valueAfter({ lines, prefix: LABELS.link }),
    body,
    replies,
  };
};

type Params = {
  readonly text: string;
};

export const parseResolverKickoff = ({ text }: Params): ParsedResolverKickoff | null => {
  const lines = text.split('\n');
  const headline = lines[0] ?? '';
  if (!LABELS.headline.test(headline)) {
    return null;
  }
  const starts: Array<{ index: number; position: number; total: number }> = [];
  let sectionAt = lines.length;
  for (const [index, line] of lines.entries()) {
    if (SECTION_LABELS.includes(line) && index < sectionAt) {
      sectionAt = index;
    }
    const match = LABELS.threadHeader.exec(line);
    if (match === null || index > sectionAt) {
      continue;
    }
    starts.push({
      index,
      position: Number(match[1]),
      total: Number(match[2]),
    });
  }
  if (starts.length === 0) {
    return null;
  }
  const threads = starts.map(({ index, position, total }, order) => {
    const end = starts[order + 1]?.index ?? sectionAt;
    return parseThread({ lines: lines.slice(index + 1, end), position, total });
  });
  return { headline, threads };
};
