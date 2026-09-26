import type { GoodboyIgnoreMode } from '@goodboy/types';

type GoodboyIgnoreChoice = {
  readonly mode: Exclude<GoodboyIgnoreMode, 'existing'>;
  readonly label: string;
  readonly hint: string;
};

export const GOODBOY_IGNORE_CHOICES: ReadonlyArray<GoodboyIgnoreChoice> = [
  {
    mode: 'this-mac',
    label: 'This Mac only',
    hint: "Nothing to commit. Teammates don't see the rule.",
  },
  {
    mode: 'project',
    label: "The project's .gitignore",
    hint: 'Teammates get it after you commit and push.',
  },
  {
    mode: 'global',
    label: 'All my repositories',
    hint: 'Adds .goodboy/ to your global git ignore. No project file changes.',
  },
];
