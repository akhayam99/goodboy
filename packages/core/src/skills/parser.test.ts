import { describe, expect, it } from 'vitest';
import { SkillParseError, parseSkillMarkdown, serializeSkillMarkdown } from './parser';

const HAPPY_PATH = `---
name: my-skill
description: Does something useful
args: [arg1, arg2]
scripts: [setup.sh]
---

# My Skill

This is the body.
`;

describe('parseSkillMarkdown', () => {
  it('parses happy path correctly', () => {
    const result = parseSkillMarkdown(HAPPY_PATH);
    expect(result.frontmatter.name).toBe('my-skill');
    expect(result.frontmatter.description).toBe('Does something useful');
    expect(result.frontmatter.args).toEqual(['arg1', 'arg2']);
    expect(result.frontmatter.scripts).toEqual(['setup.sh']);
    expect(result.body).toBe('# My Skill\n\nThis is the body.\n');
  });

  it('throws when frontmatter delimiters are missing', () => {
    expect(() => parseSkillMarkdown('name: foo\ndescription: bar\n')).toThrow(SkillParseError);
    expect(() => parseSkillMarkdown('name: foo\ndescription: bar\n')).toThrow(
      'missing or malformed frontmatter delimiters',
    );
  });

  it('throws when name is missing', () => {
    const raw = `---
description: some desc
---

body
`;
    expect(() => parseSkillMarkdown(raw)).toThrow(SkillParseError);
    expect(() => parseSkillMarkdown(raw)).toThrow('"name"');
  });

  it('throws when name does not match kebab-case pattern', () => {
    const raw = `---
name: MySkill
description: some desc
---

body
`;
    expect(() => parseSkillMarkdown(raw)).toThrow(SkillParseError);
    expect(() => parseSkillMarkdown(raw)).toThrow('"name" must match');
  });

  it('throws when description is missing', () => {
    const raw = `---
name: my-skill
---

body
`;
    expect(() => parseSkillMarkdown(raw)).toThrow(SkillParseError);
    expect(() => parseSkillMarkdown(raw)).toThrow('"description"');
  });

  it('parses inline args list', () => {
    const raw = `---
name: my-skill
description: desc
args: [a, b, c]
---

body
`;
    const { frontmatter } = parseSkillMarkdown(raw);
    expect(frontmatter.args).toEqual(['a', 'b', 'c']);
  });

  it('parses block args list', () => {
    const raw = `---
name: my-skill
description: desc
args:
- alpha
- beta
---

body
`;
    const { frontmatter } = parseSkillMarkdown(raw);
    expect(frontmatter.args).toEqual(['alpha', 'beta']);
  });

  it('defaults args and scripts to empty arrays when absent', () => {
    const raw = `---
name: my-skill
description: desc
---

body
`;
    const { frontmatter } = parseSkillMarkdown(raw);
    expect(frontmatter.args).toEqual([]);
    expect(frontmatter.scripts).toEqual([]);
  });

  it('preserves body internal whitespace', () => {
    const raw = `---
name: my-skill
description: desc
---

line1

  indented

line3
`;
    const { body } = parseSkillMarkdown(raw);
    expect(body).toBe('line1\n\n  indented\n\nline3\n');
  });

  it('trims leading newlines from body only', () => {
    const raw = `---
name: my-skill
description: desc
---


  leading blank lines stripped
`;
    const { body } = parseSkillMarkdown(raw);
    expect(body).toBe('  leading blank lines stripped\n');
  });
});

describe('serializeSkillMarkdown', () => {
  it('serialize → parse round-trip identity', () => {
    const frontmatter = {
      name: 'my-skill',
      description: 'Does something useful',
      args: ['arg1', 'arg2'] as const,
      scripts: ['setup.sh'] as const,
    };
    const body = '# My Skill\n\nThis is the body.\n';
    const serialized = serializeSkillMarkdown(frontmatter, body);
    const parsed = parseSkillMarkdown(serialized);
    expect(parsed.frontmatter.name).toBe(frontmatter.name);
    expect(parsed.frontmatter.description).toBe(frontmatter.description);
    expect(parsed.frontmatter.args).toEqual(frontmatter.args);
    expect(parsed.frontmatter.scripts).toEqual(frontmatter.scripts);
    expect(parsed.body).toBe(body);
  });

  it('skips empty args and scripts lines', () => {
    const serialized = serializeSkillMarkdown(
      { name: 'my-skill', description: 'desc', args: [], scripts: [] },
      'body',
    );
    expect(serialized).not.toContain('args:');
    expect(serialized).not.toContain('scripts:');
  });

  it('emits canonical form', () => {
    const serialized = serializeSkillMarkdown(
      { name: 'my-skill', description: 'desc', args: ['x'], scripts: ['run.sh'] },
      'body content',
    );
    expect(serialized).toBe(
      '---\nname: my-skill\ndescription: desc\nargs: [x]\nscripts: [run.sh]\n---\n\nbody content',
    );
  });
});
