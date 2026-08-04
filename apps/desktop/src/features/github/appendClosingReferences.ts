import type { ClosingIssueReference } from './closingIssueReferences';

type Params = {
  readonly body: string;
  readonly references: ReadonlyArray<ClosingIssueReference>;
};

export const appendClosingReferences = ({ body, references }: Params): string => {
  if (references.length === 0) {
    return body;
  }
  const block = references.map((reference) => reference.line).join('\n');
  const kept = body.trimEnd();
  return kept.length === 0 ? block : `${kept}\n\n${block}`;
};
