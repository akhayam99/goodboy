import { describe, expect, it, vi } from 'vitest';
import type { Skill } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';

const h = vi.hoisted(() => ({
  features: { workflows: true, skills: false },
  invokeSkillList: vi.fn(),
  invokeSkillRescan: vi.fn(),
}));

vi.mock('../../../shared/lib/features', () => ({ WORKSPACE_FEATURES: h.features }));
vi.mock('../../../features/skills/skills', () => ({
  invokeSkillList: h.invokeSkillList,
  invokeSkillRescan: h.invokeSkillRescan,
}));

import { listWorkspaceSkills, rescanWorkspaceSkills } from './workspaceSkills';

const workspaceId = aWorkspace().id;
const scanned: ReadonlyArray<Skill> = [];
const listed: ReadonlyArray<Skill> = [];

describe('workspaceSkills', () => {
  it('reads nothing from disk while the skills flag is off', async () => {
    h.features.skills = false;
    h.invokeSkillList.mockClear();
    h.invokeSkillRescan.mockClear();

    expect(await rescanWorkspaceSkills(workspaceId)).toEqual([]);
    expect(await listWorkspaceSkills(workspaceId)).toEqual([]);
    expect(h.invokeSkillRescan).not.toHaveBeenCalled();
    expect(h.invokeSkillList).not.toHaveBeenCalled();
  });

  it('rescans and lists through the IPC while the flag is on', async () => {
    h.features.skills = true;
    h.invokeSkillRescan.mockResolvedValue(scanned);
    h.invokeSkillList.mockResolvedValue(listed);

    expect(await rescanWorkspaceSkills(workspaceId)).toBe(scanned);
    expect(await listWorkspaceSkills(workspaceId)).toBe(listed);
    expect(h.invokeSkillRescan).toHaveBeenCalledWith(workspaceId);
    expect(h.invokeSkillList).toHaveBeenCalledWith(workspaceId);
  });

  it('falls back to an empty list when the IPC rejects', async () => {
    h.features.skills = true;
    h.invokeSkillRescan.mockRejectedValue(new Error('scan failed'));
    h.invokeSkillList.mockRejectedValue(new Error('list failed'));

    expect(await rescanWorkspaceSkills(workspaceId)).toEqual([]);
    expect(await listWorkspaceSkills(workspaceId)).toEqual([]);
  });
});
