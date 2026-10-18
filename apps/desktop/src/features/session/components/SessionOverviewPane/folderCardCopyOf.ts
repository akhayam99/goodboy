import type { FolderPurpose } from '@goodboy/types';
import { changesCountLabelOf } from '../../../file-versions/changesCountLabelOf';
import type { TurnChangesSummary } from '../../../file-versions/turnChanges';

type Params = Readonly<{
  purpose: FolderPurpose | null;
  counts: TurnChangesSummary | undefined;
}>;

export type FolderCardCopy = Readonly<{
  face: string | null;
  changes: string;
  readOnly: string | null;
}>;

const FACE: Readonly<Record<FolderPurpose, string>> = {
  documents: 'Documents',
  code: 'No git yet',
};

export const folderCardCopyOf = ({ purpose, counts }: Params): FolderCardCopy => ({
  face: purpose === null ? null : FACE[purpose],
  changes: (counts === undefined ? null : changesCountLabelOf({ counts })) ?? 'None yet',
  readOnly: purpose === 'documents' ? 'Word, PDF, Pages, Keynote, Numbers and Excel files' : null,
});
