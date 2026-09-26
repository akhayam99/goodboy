type Params = {
  readonly sourceText: string;
};

export type DocumentLead = {
  readonly lead: string;
  readonly rest: string;
};

const FENCE_RE = /^```/;
const HEADING_RE = /^#{1,6}\s/;

export const splitLead = ({ sourceText }: Params): DocumentLead => {
  const lines = sourceText.split('\n');
  let inFence = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && HEADING_RE.test(line)) {
      if (index === 0) {
        return { lead: '', rest: sourceText };
      }
      return {
        lead: lines.slice(0, index).join('\n').trim(),
        rest: lines.slice(index).join('\n'),
      };
    }
  }
  return { lead: '', rest: sourceText };
};
