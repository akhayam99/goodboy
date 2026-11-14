import type { ListboxOption } from '@goodboy/ui';

type Params = {
  readonly sessions: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly projects: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly branches: ReadonlyArray<string | null>;
};

type Options = Readonly<{
  sessions: ReadonlyArray<ListboxOption<string>>;
  projects: ReadonlyArray<ListboxOption<string>>;
  branches: ReadonlyArray<ListboxOption<string>>;
}>;

const NEW_SESSION_LABEL = 'New session';

const NEW_BRANCH_LABEL = 'New branch';

const NO_PROJECT_LABEL = 'No project';

export const startWorkOptionsOf = ({ sessions, projects, branches }: Params): Options => {
  const named = [...new Set(branches.filter((branch): branch is string => branch !== null))];
  return {
    sessions: [
      { value: 'new', label: NEW_SESSION_LABEL },
      ...sessions.map((session) => ({ value: session.id, label: session.title })),
    ],
    projects: [
      { value: 'none', label: NO_PROJECT_LABEL },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    branches: [
      { value: 'new', label: NEW_BRANCH_LABEL },
      ...named.map((branch) => ({ value: branch, label: branch })),
    ],
  };
};
