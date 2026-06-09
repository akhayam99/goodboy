import type { SkillFrontmatter } from '@goodboy/types';

export class SkillParseError extends Error {
  constructor(reason: string) {
    super(`SkillParseError: ${reason}`);
    this.name = 'SkillParseError';
  }
}

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\n---[ \t]*(\r?\n|$)/;

function parseList(raw: string): ReadonlyArray<string> {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const inner = trimmed.slice(1, trimmed.lastIndexOf(']'));
    return inner
      .split(',')
      .map((s) => unquote(s.trim()))
      .filter((s) => s.length > 0);
  }
  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => unquote(line.slice(2).trim()));
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseScalar(value: string): string {
  return unquote(value.trim());
}

export const parseSkillMarkdown = (
  raw: string,
): { frontmatter: SkillFrontmatter; body: string } => {
  const match = FRONTMATTER_RE.exec(raw);
  if (match === null) {
    throw new SkillParseError('missing or malformed frontmatter delimiters (expected --- ... ---)');
  }

  const frontmatterBlock = match[1] ?? '';
  const afterDelimiter = raw.slice(match[0].length);
  const body = afterDelimiter.replace(/^\n+/, '');

  const fields: Record<string, string> = {};
  const lines = frontmatterBlock.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      i++;
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1);
    const restTrimmed = rest.trim();

    if (restTrimmed.startsWith('[') || restTrimmed !== '') {
      fields[key] = restTrimmed;
      i++;
    } else {
      const blockLines: string[] = [];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i] ?? '';
        if (nextLine.trim() === '') {
          break;
        }
        if (nextLine.trimStart().startsWith('- ')) {
          blockLines.push(nextLine);
          i++;
        } else {
          break;
        }
      }
      fields[key] = blockLines.join('\n');
    }
  }

  const rawName = fields['name'];
  if (rawName === undefined || rawName.trim() === '') {
    throw new SkillParseError('field "name" is required and must be non-empty');
  }
  const name = parseScalar(rawName);
  if (!NAME_RE.test(name)) {
    throw new SkillParseError(
      `field "name" must match /^[a-z][a-z0-9-]*$/ (kebab-case), got: "${name}"`,
    );
  }

  const rawDescription = fields['description'];
  if (rawDescription === undefined || rawDescription.trim() === '') {
    throw new SkillParseError('field "description" is required and must be non-empty');
  }
  const description = parseScalar(rawDescription);

  const args: ReadonlyArray<string> =
    fields['args'] !== undefined && fields['args'].trim() !== '' ? parseList(fields['args']) : [];

  const scripts: ReadonlyArray<string> =
    fields['scripts'] !== undefined && fields['scripts'].trim() !== ''
      ? parseList(fields['scripts'])
      : [];

  const frontmatter: SkillFrontmatter = { name, description, args, scripts };
  return { frontmatter, body };
};

export const serializeSkillMarkdown = (frontmatter: SkillFrontmatter, body: string): string => {
  const lines: string[] = ['---'];
  lines.push(`name: ${frontmatter.name}`);
  lines.push(`description: ${frontmatter.description}`);

  const args = frontmatter.args ?? [];
  if (args.length > 0) {
    lines.push(`args: [${args.join(', ')}]`);
  }

  const scripts = frontmatter.scripts ?? [];
  if (scripts.length > 0) {
    lines.push(`scripts: [${scripts.join(', ')}]`);
  }

  lines.push('---');
  lines.push('');
  lines.push(body);

  return lines.join('\n');
};
