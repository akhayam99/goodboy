import type { PermissionRulePattern } from '@goodboy/types';

const EDIT_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

type Params = {
  readonly pattern: PermissionRulePattern;
};

const stripWildcard = (matcher: string): string => matcher.replace(/(?::\*|\s\*|\*)$/, '').trim();

export const describeRule = ({ pattern }: Params): string => {
  const matcher = pattern.argsMatcher?.trim() ?? '';
  if (pattern.tool === 'Bash') {
    const prefix = stripWildcard(matcher);
    return prefix === '' ? 'Any command' : `Commands starting with "${prefix}"`;
  }
  if (EDIT_TOOLS.has(pattern.tool)) {
    return matcher === '' ? 'Edits to files' : `Edits to ${matcher}`;
  }
  return matcher === '' ? pattern.tool : `${pattern.tool}(${matcher})`;
};
