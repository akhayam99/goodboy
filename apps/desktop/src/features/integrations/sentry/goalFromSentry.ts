import { composeGoal } from '../shared/composeGoal';
import type { SentryIssue, SentryIssueDetail, SentryStackFrame } from './client';

const MAX_FRAMES = 10;

const formatFrame = ({ frame }: { readonly frame: SentryStackFrame }): string => {
  const location = frame.filename ?? '?';
  const line = frame.line_no != null ? `:${frame.line_no}` : '';
  const fn = frame.function ?? '?';
  return `  at ${fn} (${location}${line})`;
};

type Params = {
  readonly issue: SentryIssue;
  readonly detail?: SentryIssueDetail | null;
};

export const goalFromSentry = ({ issue, detail }: Params): string => {
  const label = issue.shortId ?? issue.id;
  const title = (detail?.title ?? issue.title).trim();
  const heading = `[${label}] ${title}`;

  const sections: string[] = [];
  const culprit = (detail?.culprit ?? issue.culprit ?? '').trim();
  if (culprit !== '') {
    sections.push(culprit);
  }
  const frames = detail?.frames ?? [];
  if (frames.length > 0) {
    const inApp = frames.filter((f) => f.in_app);
    const chosen = (inApp.length > 0 ? inApp : frames).slice(0, MAX_FRAMES);
    const stack = chosen.map((frame) => formatFrame({ frame })).join('\n');
    if (stack !== '') {
      sections.push(stack);
    }
  }

  return composeGoal({
    heading,
    body: sections.join('\n\n'),
    source: { noun: 'issue', reference: label, url: issue.permalink },
  });
};
