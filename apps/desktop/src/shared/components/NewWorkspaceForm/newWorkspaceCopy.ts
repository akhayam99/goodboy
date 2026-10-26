import type { NewWorkspaceMode } from './newWorkspaceMode';

type CopyParams = {
  readonly mode: NewWorkspaceMode;
  readonly targetName: string;
};

export const copyOf = ({ mode, targetName }: CopyParams) => {
  switch (mode) {
    case 'first-run':
      return {
        title: 'Your first workspace',
        lede: 'A workspace is what you work on: a repository, a folder of repositories, or a folder of documents. Agents read and edit files only inside its folders.',
      };
    case 'new':
      return {
        title: 'New workspace',
        lede: 'Pick the folder you work in. A folder that holds several repositories works too.',
      };
    case 'add':
      return {
        title: 'Add a folder',
        lede: `Agents read and edit files only inside the folders of ${targetName === '' ? 'this workspace' : targetName}.`,
      };
    default: {
      const unreachable: never = mode;
      return unreachable;
    }
  }
};
