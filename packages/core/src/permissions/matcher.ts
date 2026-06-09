import type { PermissionRulePattern } from '@goodboy/types';

export type ToolMatcher = {
  matches(toolName: string, input: unknown): boolean;
};

const REGEX_METACHARS = /[.+?()[\]{}\^$|\\]/g;

function globToRegex(glob: string): RegExp {
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
      pattern += ch!.replace(REGEX_METACHARS, '\\$&');
      i += 1;
    }
  }
  return new RegExp(`^${pattern}$`);
}

export const parseArgsMatcher = (matcher: string): ((input: unknown) => boolean) => {
  if (!matcher) {
    return () => true;
  }
  const re = globToRegex(matcher);
  return (input: unknown) => {
    const str = stringifyInput('', input);
    return re.test(str);
  };
};

function stringifyInput(toolName: string, input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }
  const obj = input as Record<string, unknown>;
  if (toolName === 'Bash') {
    return typeof obj['command'] === 'string' ? obj['command'] : JSON.stringify(input);
  }
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(toolName)) {
    return typeof obj['file_path'] === 'string' ? obj['file_path'] : JSON.stringify(input);
  }
  return JSON.stringify(input);
}

export const parseToolPattern = (pattern: string): ToolMatcher => {
  const parenIdx = pattern.indexOf('(');

  if (parenIdx === -1) {
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
      if (toolName !== tool) {
        return false;
      }
      const str = stringifyInput(toolName, input);
      return argsRe.test(str);
    },
  };
};

export const formatToolPattern = (pattern: PermissionRulePattern): string => {
  if (!pattern.argsMatcher) {
    return pattern.tool;
  }
  return `${pattern.tool}(${pattern.argsMatcher})`;
};
