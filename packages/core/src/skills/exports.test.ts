import { describe, expect, it } from 'vitest';
import * as skills from './index';

describe('skills barrel exports', () => {
  it('exposes parser, executor, registry, and slash entrypoints', () => {
    expect(skills.parseSlashCommand).toBeTypeOf('function');
    expect(skills.parseSkillMarkdown).toBeTypeOf('function');
    expect(skills.serializeSkillMarkdown).toBeTypeOf('function');
    expect(skills.SkillExecutor).toBeTypeOf('function');
    expect(skills.SkillRegistry).toBeTypeOf('function');
    expect(skills.SkillParseError).toBeTypeOf('function');
    expect(skills.SkillScriptError).toBeTypeOf('function');
    expect(skills.SkillRegistryError).toBeTypeOf('function');
  });
});
