type Params = Readonly<{
  content: string;
}>;

const LEADS: ReadonlyArray<string> = [
  'please',
  'ok',
  'okay',
  'now',
  'and',
  'also',
  'can you',
  'could you',
  'would you',
  'will you',
  'i want you to',
  "i'd like you to",
  'i would like you to',
  'you should',
  'we should',
  "let's",
];

const CHANGE_VERBS: ReadonlySet<string> = new Set([
  'add',
  'change',
  'cut',
  'drop',
  'edit',
  'exclude',
  'expand',
  'extend',
  'include',
  'keep',
  'make',
  'merge',
  'move',
  'remove',
  'rename',
  'reorder',
  'replace',
  'revise',
  'rework',
  'rewrite',
  'shorten',
  'simplify',
  'skip',
  'split',
  'swap',
  'tighten',
  'update',
  'use',
]);

const PLAN_PHRASES: ReadonlyArray<string> = [
  'the plan',
  'your plan',
  'this plan',
  'the steps',
  'step ',
];

const stripLeads = (text: string): string => {
  let rest = text;
  let isStripping = true;
  while (isStripping) {
    const lead = LEADS.find((candidate) => rest.startsWith(`${candidate} `));
    isStripping = lead !== undefined;
    if (lead !== undefined) {
      rest = rest.slice(lead.length).trimStart();
    }
  }
  return rest;
};

const firstWord = (text: string): string => {
  const end = text.search(/[\s,.:;!?]/);
  return end === -1 ? text : text.slice(0, end);
};

export const isPlanChangeRequest = ({ content }: Params): boolean => {
  const text = content.trim().toLowerCase();
  if (text.length === 0) {
    return false;
  }
  const stripped = stripLeads(text);
  if (text.endsWith('?') && stripped === text) {
    return false;
  }
  if (!CHANGE_VERBS.has(firstWord(stripped))) {
    return false;
  }
  return PLAN_PHRASES.some((phrase) => text.includes(phrase)) || text.split(/\s+/).length > 2;
};
