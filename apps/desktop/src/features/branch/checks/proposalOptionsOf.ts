import { outsideFence } from './outsideFence';

type Params = {
  readonly text: string;
};

type ProposalOption = {
  readonly key: string;
  readonly title: string;
  readonly body: string;
};

export type ProposalOptions = {
  readonly lead: string;
  readonly options: ReadonlyArray<ProposalOption>;
  readonly recommendedKey: string | null;
  readonly reason: string;
};

type TrimParams = {
  readonly text: string;
};

const trimLead = ({ text }: TrimParams) => text.trim().replace(/^[:.,;)-]+\s*/, '');

const OPTION_HEADING = /^#{3}\s+(?:Option|Opzione)\s+([A-Za-z])(?![A-Za-z0-9])(.*)$/;
const RECOMMENDED_LINE =
  /^(?:[Rr]ecommended|[Cc]onsigliat[ao])\s*:\s*(?:(?:[Oo]ption|[Oo]pzione)\s+)?([A-Z])(?![A-Za-z0-9])(.*)$/;

export const proposalOptionsOf = ({ text }: Params): ProposalOptions | null => {
  const lines = text.split('\n');
  const isPlain = outsideFence({ lines });
  const headings = lines.flatMap((line, index) => {
    const match = isPlain[index] === true ? OPTION_HEADING.exec(line.trim()) : null;
    return match === null
      ? []
      : [{ index, key: (match[1] ?? '').toUpperCase(), title: trimLead({ text: match[2] ?? '' }) }];
  });
  const first = headings[0];
  if (first === undefined || headings.length < 2) {
    return null;
  }
  if (new Set(headings.map((heading) => heading.key)).size !== headings.length) {
    return null;
  }
  const recommendedIndex = lines.reduce(
    (latest, line, index) =>
      index > first.index && isPlain[index] === true && RECOMMENDED_LINE.test(line.trim())
        ? index
        : latest,
    -1,
  );
  const recommended =
    recommendedIndex < 0 ? null : RECOMMENDED_LINE.exec(lines[recommendedIndex]?.trim() ?? '');
  const optionsEnd = recommendedIndex < 0 ? lines.length : recommendedIndex;
  const options = headings.map((heading, position) => ({
    key: heading.key,
    title: heading.title,
    body: lines
      .slice(heading.index + 1, headings[position + 1]?.index ?? optionsEnd)
      .join('\n')
      .trim(),
  }));
  const recommendedKey = recommended?.[1] ?? null;
  const isKnown = options.some((option) => option.key === recommendedKey);
  const reason =
    recommended === null || !isKnown
      ? ''
      : [trimLead({ text: recommended[2] ?? '' }), ...lines.slice(recommendedIndex + 1)]
          .join('\n')
          .trim();
  return {
    lead: lines.slice(0, first.index).join('\n').trim(),
    options,
    recommendedKey: isKnown ? recommendedKey : null,
    reason,
  };
};
