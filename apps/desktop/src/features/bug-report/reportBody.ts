import { redactSecrets } from '../../shared/utils/redactSecrets';
import type { ReportContext } from '../settings/reportContext';
import {
  buildIssueUrl,
  capIssueTitle,
  fitsIssueUrl,
  longestFittingPrefix,
  withoutLoneSurrogates,
} from '../settings/issueUrl';
import { issueTypeLabel, type IssueTypeValue } from '../settings/reportIssueTypes';

export type ReportPartId = 'version' | 'system' | 'screen' | 'cliVersions' | 'error' | 'notice';

export type ReportPart = {
  readonly id: ReportPartId;
  readonly chip: string;
  readonly text: string;
  readonly isBlock: boolean;
};

const NO_CLI = 'none detected';

type ContextPartsParams = {
  readonly context: ReportContext;
};

export const contextParts = ({ context }: ContextPartsParams): ReadonlyArray<ReportPart> => [
  {
    id: 'version',
    chip: `${context.version} · ${context.build}`,
    text: `Version: ${context.version} (build ${context.build})`,
    isBlock: false,
  },
  { id: 'system', chip: context.system, text: `System: ${context.system}`, isBlock: false },
  { id: 'screen', chip: context.screen, text: `Screen: ${context.screen}`, isBlock: false },
  {
    id: 'cliVersions',
    chip: context.cliVersions === NO_CLI ? 'No CLI found' : context.cliVersions,
    text: `CLI versions: ${context.cliVersions}`,
    isBlock: false,
  },
];

const fenced = ({ heading, text }: { readonly heading: string; readonly text: string }): string =>
  `**${heading}**\n\`\`\`\n${text.replaceAll('```', "'''")}\n\`\`\``;

export const STACK_FRAME_LIMIT = 8;

const FOREIGN_FRAME =
  /node_modules|\/\.vite\/deps\/|\/@fs\/|chunk-[A-Z0-9]{6,}|react-dom|scheduler/;

const FRAME_LINE = /^\s*(?:at\s|\S*@\S)/;

type TrimStackParams = {
  readonly stack: string | null | undefined;
};

export const trimStack = ({ stack }: TrimStackParams): string => {
  if (stack == null) {
    return '';
  }
  const ours = stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => FRAME_LINE.test(line) && !FOREIGN_FRAME.test(line));
  return ours.slice(0, STACK_FRAME_LIMIT).join('\n');
};

type ErrorPartParams = {
  readonly message: string;
  readonly stack: string;
  readonly componentStack: string;
};

export const errorPart = ({ message, stack, componentStack }: ErrorPartParams): ReportPart => ({
  id: 'error',
  chip: 'Error and stack',
  text: [
    fenced({ heading: 'Error', text: message }),
    stack === '' ? '' : fenced({ heading: 'Stack', text: stack }),
    componentStack === '' ? '' : fenced({ heading: 'Where it broke', text: componentStack }),
  ]
    .filter((block) => block !== '')
    .join('\n\n'),
  isBlock: true,
});

type NoticePartParams = {
  readonly title: string;
  readonly body: string;
};

export const noticePart = ({ title, body }: NoticePartParams): ReportPart => ({
  id: 'notice',
  chip: 'Notification',
  text: fenced({ heading: 'Notification', text: body === '' ? title : `${title}\n\n${body}` }),
  isBlock: true,
});

type BuildReportParams = {
  readonly issueType: IssueTypeValue;
  readonly line: string;
  readonly detail: string;
  readonly parts: ReadonlyArray<ReportPart>;
  readonly excluded: ReadonlySet<ReportPartId>;
};

export type BuiltReport = {
  readonly title: string;
  readonly body: string;
};

const clean = (text: string): string => withoutLoneSurrogates({ text: redactSecrets({ text }) });

export const buildReport = ({
  issueType,
  line,
  detail,
  parts,
  excluded,
}: BuildReportParams): BuiltReport => {
  const kept = parts.filter((part) => !excluded.has(part.id));
  const lines = kept.filter((part) => !part.isBlock).map((part) => part.text);
  const blocks = kept.filter((part) => part.isBlock).map((part) => part.text);
  const facts = [`Type: ${issueTypeLabel({ issueType })}`, ...lines].join('\n');
  const attached = [facts, ...blocks].join('\n\n');
  const note = clean(detail.trim());
  return {
    title: capIssueTitle({ title: clean(line.trim().replace(/\s+/g, ' ')) }),
    body: note === '' ? attached : `${note}\n\n${attached}`,
  };
};

const REDACTION_MARK = /\[(?:redacted|email|url|id|ip|user|name-\d+)\]|~\/…|\/…/g;

type CountParams = {
  readonly parts: ReadonlyArray<ReportPart>;
  readonly excluded: ReadonlySet<ReportPartId>;
};

const countRedactions = ({ parts, excluded }: CountParams): number =>
  parts
    .filter((part) => !excluded.has(part.id))
    .reduce((total, part) => total + (part.text.match(REDACTION_MARK)?.length ?? 0), 0);

export const previewSummary = ({ parts, excluded }: CountParams): string => {
  const count = countRedactions({ parts, excluded });
  const redacted =
    count === 0 ? 'nothing redacted' : `${count} ${count === 1 ? 'thing' : 'things'} redacted`;
  return `${redacted} · nothing from your prompts`;
};

export const NEVER_SENT =
  'Never sent: prompts and replies, transcripts, diffs, file contents, logs, screenshots, project, repository and branch names, ids, the clipboard, environment variables and keys.';

const OVERFLOW_NOTICE =
  '\n\n[The rest did not fit the link. It is on your clipboard: paste it here.]';

type ReportLinkParams = {
  readonly title: string;
  readonly body: string;
};

export type ReportLink = {
  readonly url: string;
  readonly overflows: boolean;
};

export const buildReportLink = ({ title, body }: ReportLinkParams): ReportLink => {
  if (fitsIssueUrl({ title, body })) {
    return { url: buildIssueUrl({ title, body }), overflows: false };
  }
  const cut = longestFittingPrefix({
    text: body,
    marker: OVERFLOW_NOTICE,
    fits: ({ candidate }) => fitsIssueUrl({ title, body: candidate }),
  });
  return { url: buildIssueUrl({ title, body: cut }), overflows: true };
};
