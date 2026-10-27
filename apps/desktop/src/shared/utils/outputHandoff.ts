import { redactSecrets } from './redactSecrets';

const OUTPUT_HANDOFF_MAX_CHARS = 24_000;

const RAW_INPUT_MAX_CHARS = OUTPUT_HANDOFF_MAX_CHARS * 8;

export const OUTPUT_HANDOFF_MIME = 'text/plain';

export type OutputHandoff = {
  readonly id: string;
  readonly title: string;
  readonly fileName: string;
  readonly text: string;
  readonly isTruncated: boolean;
};

type TitleParams = {
  readonly subject: string;
  readonly outcome: string | null;
  readonly projectName: string | null;
  readonly branch: string | null;
};

type TailParams = {
  readonly text: string;
  readonly maxChars: number;
};

type TailResult = {
  readonly text: string;
  readonly isTruncated: boolean;
};

type PlaceParams = Pick<TitleParams, 'projectName' | 'branch'>;

type MarkParams = {
  readonly shown: number;
  readonly total: number;
};

type HandoffParams = TitleParams & {
  readonly output: string;
};

const placeOf = ({ projectName, branch }: PlaceParams): string | null => {
  const hasProject = projectName !== null && projectName !== '';
  const hasBranch = branch !== null && branch !== '';
  if (hasProject && hasBranch) {
    return `${projectName} on ${branch}`;
  }
  if (hasProject) {
    return projectName;
  }
  return hasBranch ? branch : null;
};

const outputHandoffTitle = ({ subject, outcome, projectName, branch }: TitleParams): string => {
  const parts = [`Output of ${subject}`];
  if (outcome !== null && outcome !== '') {
    parts.push(outcome);
  }
  const place = placeOf({ projectName, branch });
  if (place !== null) {
    parts.push(place);
  }
  return parts.join(', ');
};

const tailOfOutput = ({ text, maxChars }: TailParams): TailResult => {
  if (text.length <= maxChars) {
    return { text, isTruncated: false };
  }
  const cut = text.slice(text.length - maxChars);
  const firstBreak = cut.indexOf('\n');
  const isMidLine = text.charAt(text.length - maxChars - 1) !== '\n';
  const kept = isMidLine && firstBreak >= 0 ? cut.slice(firstBreak + 1) : cut;
  return { text: kept, isTruncated: true };
};

const truncatedMark = ({ shown, total }: MarkParams): string =>
  `[truncated: the last ${shown.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} characters follow]`;

export const outputHandoffOf = ({ output, ...titleParams }: HandoffParams): OutputHandoff => {
  const title = outputHandoffTitle(titleParams);
  const bounded =
    output.length > RAW_INPUT_MAX_CHARS
      ? output.slice(output.length - RAW_INPUT_MAX_CHARS)
      : output;
  const redacted = redactSecrets({ text: bounded });
  const tail = tailOfOutput({ text: redacted.trimEnd(), maxChars: OUTPUT_HANDOFF_MAX_CHARS });
  const isTruncated = tail.isTruncated || bounded.length < output.length;
  const mark = isTruncated
    ? `${truncatedMark({ shown: tail.text.length, total: output.length })}\n`
    : '';
  return {
    id: crypto.randomUUID(),
    title,
    fileName: `${title.replace(/[\\/]/g, '-')}.txt`,
    text: `${title}\n\n${mark}${tail.text}\n`,
    isTruncated,
  };
};
