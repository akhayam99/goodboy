import { describe, expect, it } from 'vitest';
import { serializeSkillMarkdown } from './parser';

describe('serializeSkillMarkdown', () => {
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
