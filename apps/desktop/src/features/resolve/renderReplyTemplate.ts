export const REPLY_TEMPLATE_VARIABLES = [
  'reason',
  'commit',
  'fixup_of',
  'reviewer',
  'file',
  'line',
] as const;

export type ReplyTemplateVariable = (typeof REPLY_TEMPLATE_VARIABLES)[number];

export type ReplyTemplateVars = Readonly<Partial<Record<ReplyTemplateVariable, string>>>;

const VARIABLE_PATTERN = /\{([^{}\s]+)\}/g;

const KNOWN: ReadonlySet<string> = new Set(REPLY_TEMPLATE_VARIABLES);

export const renderReplyTemplate = ({
  template,
  vars,
}: {
  readonly template: string;
  readonly vars: ReplyTemplateVars;
}): string =>
  template
    .replace(VARIABLE_PATTERN, (match, name: string) =>
      KNOWN.has(name) ? (vars[name as ReplyTemplateVariable] ?? '') : match,
    )
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const replyTemplateProblems = ({
  template,
}: {
  readonly template: string;
}): ReadonlyArray<string> => {
  const names = [...template.matchAll(VARIABLE_PATTERN)].map(([, name]) => name ?? '');
  const unknown = [...new Set(names.filter((name) => !KNOWN.has(name)))];
  return [
    ...(names.includes('reason') ? [] : ['Add {reason}, where the reply goes']),
    ...unknown.map((name) => `Unknown variable {${name}}`),
  ];
};
