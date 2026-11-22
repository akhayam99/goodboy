import type { BranchEntries, BranchEntry } from './branchStoryOf';

type Params = {
  readonly branches: BranchEntries;
};

type WordParams = {
  readonly word: string;
};

const SHOWN_PROJECTS = 3;

const quietWordOf = ({ word }: WordParams): string => {
  const second = word.charAt(1);
  if (second === '' || second !== second.toLowerCase()) {
    return word;
  }
  return `${word.charAt(0).toLowerCase()}${word.slice(1)}`;
};

export const overviewStatusOf = ({ branches }: Params): string | null => {
  const byProject = new Map<string, BranchEntry>();
  for (const entry of [...branches.live, ...branches.finished]) {
    const name = entry.fact.projectName;
    if (!byProject.has(name)) {
      byProject.set(name, entry);
    }
  }
  if (byProject.size === 0) {
    return null;
  }
  const lines = [...byProject.entries()]
    .slice(0, SHOWN_PROJECTS)
    .map(([name, entry]) => `${name}: ${quietWordOf({ word: entry.story.word })}.`);
  const rest = byProject.size - SHOWN_PROJECTS;
  const more = rest > 0 ? [`${rest} more ${rest === 1 ? 'project' : 'projects'}.`] : [];
  return [...lines, ...more].join(' ');
};
