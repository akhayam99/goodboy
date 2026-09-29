import type { SkillFrontmatter } from '@goodboy/types';

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
