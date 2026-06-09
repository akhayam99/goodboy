import { describe, expect, it, vi } from 'vitest';
import type { Skill } from '@goodboy/types';
import { SkillExecutor, SkillScriptError } from './executor';
import type { SkillScriptRunner } from './executor';

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-1' as Skill['id'],
    workspaceId: 'ws-1' as Skill['workspaceId'],
    name: 'test-skill',
    description: 'test',
    filePath: '/workspace/.kay/skills/test-skill.md',
    body: '',
    frontmatter: { name: 'test-skill', description: 'test' },
    createdAt: '2024-01-01T00:00:00Z' as Skill['createdAt'],
    updatedAt: '2024-01-01T00:00:00Z' as Skill['updatedAt'],
    ...overrides,
  };
}

const executor = new SkillExecutor();

describe('SkillExecutor.resolve', () => {
  it('substitutes {{arg0}} and {{arg1}} from args', async () => {
    const skill = makeSkill({ body: 'Hello {{arg0}}, you are {{arg1}}!' });
    const result = await executor.resolve({
      skill,
      args: ['world', 'great'],
      workingDir: '/workspace',
    });
    expect(result).toBe('Hello world, you are great!');
  });

  it('substitutes missing positional with empty string', async () => {
    const skill = makeSkill({ body: 'a={{arg0}} b={{arg1}} c={{arg2}}' });
    const result = await executor.resolve({ skill, args: ['only-zero'], workingDir: '/workspace' });
    expect(result).toBe('a=only-zero b= c=');
  });

  it('substitutes {{script:foo}} when runner returns canned stdout', async () => {
    const runner: SkillScriptRunner = {
      runScript: vi.fn().mockResolvedValue('canned-output'),
    };
    const skill = makeSkill({
      body: 'result={{script:setup}}',
      frontmatter: {
        name: 'test-skill',
        description: 'test',
        scripts: ['setup.sh'],
      },
    });
    const result = await executor.resolve({
      skill,
      args: [],
      workingDir: '/workspace',
      runner,
    });
    expect(result).toBe('result=canned-output');
    expect(runner.runScript).toHaveBeenCalledWith(
      '/workspace/.kay/skills/setup.sh',
      [],
      '/workspace',
    );
  });

  it('does not execute scripts not in frontmatter scripts list', async () => {
    const runner: SkillScriptRunner = {
      runScript: vi.fn().mockResolvedValue('should-not-appear'),
    };
    const skill = makeSkill({
      body: 'result={{script:other}}',
      frontmatter: {
        name: 'test-skill',
        description: 'test',
        scripts: [],
      },
    });
    const result = await executor.resolve({
      skill,
      args: [],
      workingDir: '/workspace',
      runner,
    });
    expect(result).toBe('result={{script:other}}');
    expect(runner.runScript).not.toHaveBeenCalled();
  });

  it('propagates SkillScriptError when runner throws', async () => {
    const error = new SkillScriptError('script failed', 'bash: not found');
    const runner: SkillScriptRunner = {
      runScript: vi.fn().mockRejectedValue(error),
    };
    const skill = makeSkill({
      body: '{{script:setup}}',
      frontmatter: {
        name: 'test-skill',
        description: 'test',
        scripts: ['setup.sh'],
      },
    });
    await expect(
      executor.resolve({ skill, args: [], workingDir: '/workspace', runner }),
    ).rejects.toThrow(SkillScriptError);
  });

  it('refuses script path that resolves outside .kay/skills via path traversal', async () => {
    const runner: SkillScriptRunner = {
      runScript: vi.fn(),
    };
    const skill = makeSkill({
      body: '{{script:evil}}',
      frontmatter: {
        name: 'test-skill',
        description: 'test',
        scripts: ['../../evil.sh'],
      },
    });
    await expect(
      executor.resolve({ skill, args: [], workingDir: '/workspace', runner }),
    ).rejects.toThrow(SkillScriptError);
    expect(runner.runScript).not.toHaveBeenCalled();
  });
});
