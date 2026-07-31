// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

type Skill = {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string;
  readonly filePath: string;
  readonly body: string;
  readonly frontmatter: { readonly name: string; readonly description: string };
  readonly createdAt: string;
  readonly updatedAt: string;
};

const { state } = vi.hoisted(() => ({
  state: {
    skills: [] as ReadonlyArray<Skill>,
    loadSkills: vi.fn(async () => undefined),
    saveSkill: vi.fn(async () => undefined),
    deleteSkill: vi.fn(async () => undefined),
    rescanSkills: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => {
  const getStoreState = () => ({
    skills: { 'ws-1': state.skills },
    loadSkills: state.loadSkills,
    saveSkill: state.saveSkill,
    deleteSkill: state.deleteSkill,
    rescanSkills: state.rescanSkills,
  });
  const useAppStore = <T,>(selector: (storeState: ReturnType<typeof getStoreState>) => T) =>
    selector(getStoreState());
  return { useAppStore, EMPTY_ARRAY: [] };
});

import { SkillsPanel } from './index';

const buildSkill = (): Skill => ({
  id: 'skill-1',
  workspaceId: 'ws-1',
  name: 'my-skill',
  description: 'does a thing',
  filePath: '/repo/.claude/skills/my-skill.md',
  body: 'do the thing',
  frontmatter: { name: 'my-skill', description: 'does a thing' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

beforeEach(() => {
  state.skills = [buildSkill()];
  state.loadSkills = vi.fn(async () => undefined);
  state.saveSkill = vi.fn(async () => undefined);
  state.deleteSkill = vi.fn(async () => undefined);
  state.rescanSkills = vi.fn(async () => undefined);
});

afterEach(cleanup);

describe('SkillsPanel', () => {
  it('arms the delete with an inline confirmation before calling deleteSkill', async () => {
    render(<SkillsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(state.deleteSkill).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Delete "my-skill"?' })).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete my-skill' }));
    });

    expect(state.deleteSkill).toHaveBeenCalledWith('skill-1', 'ws-1');
  });

  it('dismisses the confirmation on cancel without deleting', () => {
    render(<SkillsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(state.deleteSkill).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Delete "my-skill"?' })).toBeNull();
  });
});
