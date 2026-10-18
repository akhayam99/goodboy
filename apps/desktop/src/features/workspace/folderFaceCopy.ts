import type { FolderPurpose } from '@goodboy/types';

type FaceCopy = {
  readonly label: string;
  readonly hint: string;
  readonly chip: string;
  readonly home: string;
  readonly meaning: string;
};

const FACES = {
  code: {
    label: 'Code project',
    hint: 'Agents edit the code here. Add git for branches and pull requests.',
    chip: 'No git yet',
    home: 'Code, no git yet',
    meaning:
      'Agents edit the code in place, and every change can be restored. Track it with git for branches and pull requests.',
  },
  documents: {
    label: 'Documents',
    hint: 'Notes, writing, research. Agents edit text; every change can be restored.',
    chip: 'Documents',
    home: 'Documents',
    meaning:
      'Agents edit Markdown and text files in place and leave Word, PDF, Pages and Keynote files alone. Every change can be restored.',
  },
} as const satisfies Record<FolderPurpose, FaceCopy>;

export const FOLDER_FACE_COPY = {
  ...FACES,
  faces: ['code', 'documents'] satisfies ReadonlyArray<FolderPurpose>,
  documentsReadOnly:
    'Agents edit Markdown and text files. Word, PDF, Pages and Keynote files stay read only.',
  documentsSaved: 'Every change is saved as a version on this Mac.',
  plainChip: 'Plain folder',
  pickBlock: 'Pick what this folder is for.',
  inPlaceTrust: 'Agents edit files in place. Each turn is saved first, so you can restore it.',
  branchTrust: 'Agents work on their own branch. Nothing is pushed until you ask.',
} as const;
