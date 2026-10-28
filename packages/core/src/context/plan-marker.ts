import { canonicalizeMarkers } from './canonicalizeMarkers';

export const PLAN_OPEN = '<<plan>>';
export const PLAN_CLOSE = '<</plan>>';

export type ExtractedPlan = {
  readonly title: string;
  readonly bodyMd: string;
};

type TextParams = {
  readonly assistantText: string;
};

type RawParams = {
  readonly raw: string;
};

const lastPlanBlock = ({ assistantText }: TextParams): string | null => {
  let closeAt = assistantText.lastIndexOf(PLAN_CLOSE);
  while (closeAt !== -1) {
    const openAt = assistantText.lastIndexOf(PLAN_OPEN, closeAt);
    if (openAt !== -1) {
      const value = assistantText.slice(openAt + PLAN_OPEN.length, closeAt).trim();
      if (value.length > 0) {
        return value;
      }
    }
    closeAt = closeAt === 0 ? -1 : assistantText.lastIndexOf(PLAN_CLOSE, closeAt - 1);
  }
  return null;
};

const parsePlanBody = ({ raw }: RawParams): ExtractedPlan | null => {
  const lines = raw.split('\n');
  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const ln = (lines[i] ?? '').trim();
    if (ln.length > 0) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) {
    return null;
  }
  const titleLine = (lines[firstIdx] ?? '').trim();
  const title = titleLine.replace(/^#+\s*/, '').trim();
  if (title.length === 0) {
    return null;
  }
  const restLines = lines.slice(firstIdx + 1);
  const joined = restLines.join('\n').replace(/^\n+/, '');
  let end = joined.length;
  while (end > 0 && joined[end - 1] === '\n') {
    end -= 1;
  }
  let bodyMd = joined.slice(0, end);
  if (bodyMd.length === 0) {
    bodyMd = title;
  }
  return { title, bodyMd };
};

export const planFromMarker = ({ assistantText }: TextParams): ExtractedPlan | null => {
  const raw = lastPlanBlock({ assistantText: canonicalizeMarkers({ text: assistantText }) });
  if (raw === null) {
    return null;
  }
  return parsePlanBody({ raw });
};
