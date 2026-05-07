import type { PermissionRulePattern } from '@kay-am/types';

export interface ToolMatcher {
  matches(toolName: string, input: unknown): boolean;
}

// Regex metachars excluding * (handled separately as glob wildcard)
const REGEX_METACHARS = /[.+?()[\]{}\^$|\\]/g;

function globToRegex(glob: string): RegExp {
  // Split on ** and * BEFORE escaping other metachars so we can handle them independently
  // Strategy: walk char by char building pattern
  let pattern = '';
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      pattern += '.*';
      i += 2;
    } else if (ch === '*') {
      pattern += '[^:/]*';
      i += 1;
    } else {
      // escape regex metachar
      pattern += ch!.replace(REGEX_METACHARS, '\\$&');
      i += 1;
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function parseArgsMatcher(matcher: string): (input: unknown) => boolean {
  if (!matcher) return () => true;
  const re = globToRegex(matcher);
  return (input: unknown) => {
    const str = stringifyInput('', input);
    return re.test(str);
  };
}

function stringifyInput(toolName: string, input: unknown): string {
  if (input === null || input === undefined) return '';
  const obj = input as Record<string, unknown>;
  if (toolName === 'Bash') {
    return typeof obj['command'] === 'string' ? obj['command'] : JSON.stringify(input);
  }
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
    return typeof obj['file_path'] === 'string' ? obj['file_path'] : JSON.stringify(input);
  }
  return JSON.stringify(input);
}

export function parseToolPattern(pattern: string): ToolMatcher {
  const parenIdx = pattern.indexOf('(');

  if (parenIdx === -1) {
    // bare tool name or wildcard `*`
    const tool = pattern.trim();
    if (tool === '*') {
      return { matches: () => true };
    }
    return {
      matches(toolName: string, _input: unknown): boolean {
        return toolName === tool;
      },
    };
  }

  const tool = pattern.slice(0, parenIdx).trim();
  const argsGlob = pattern.slice(parenIdx + 1, pattern.lastIndexOf(')'));

  const argsRe = globToRegex(argsGlob);

  return {
    matches(toolName: string, input: unknown): boolean {
      if (toolName !== tool) return false;
      const str = stringifyInput(toolName, input);
      return argsRe.test(str);
    },
  };
}

export function formatToolPattern(pattern: PermissionRulePattern): string {
  if (!pattern.argsMatcher) return pattern.tool;
  return `${pattern.tool}(${pattern.argsMatcher})`;
}
