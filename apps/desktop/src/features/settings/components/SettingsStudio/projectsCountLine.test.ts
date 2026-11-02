import { describe, expect, it } from 'vitest';
import { projectsCountLine } from './projectsCountLine';

describe('projectsCountLine', () => {
  it('counts repositories as projects and names the plain folders apart', () => {
    expect(projectsCountLine({ repoCount: 3, folderCount: 1 })).toBe('3 projects, 1 plain folder');
  });

  it('says nothing about plain folders when there are none', () => {
    expect(projectsCountLine({ repoCount: 1, folderCount: 0 })).toBe('1 project');
  });

  it('pluralises plain folders', () => {
    expect(projectsCountLine({ repoCount: 0, folderCount: 2 })).toBe('0 projects, 2 plain folders');
  });
});
