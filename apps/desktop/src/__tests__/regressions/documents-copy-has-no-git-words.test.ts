// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { folderFaceLineOf } from '../../app/components/SessionRail/SessionLevel/folderFaceLineOf';
import { folderCardCopyOf } from '../../features/session/components/SessionOverviewPane/folderCardCopyOf';
import { FOLDER_FACE_COPY } from '../../features/workspace/folderFaceCopy';
import { describeCopy, scanCopy } from './scanCopy';

const GIT_WORDS =
  /(?<![\w-])(git|branch(?:es)?|commits?|pull requests?|push(?:es|ed|ing)?|rebas(?:e|es|ed|ing)|merg(?:e|es|ed|ing)|diffs?|repositor(?:y|ies)|worktrees?)(?![\w-])/i;

const DOCUMENTS_COPY_ROOTS: ReadonlyArray<string> = [
  'features/session/components/SessionWorkspace/parts/ChangesPane/',
  'features/chat/components/TurnChangesCard/',
  'features/file-versions/',
];

const documentsCopy = () =>
  scanCopy().filter((copy) => DOCUMENTS_COPY_ROOTS.some((root) => copy.path.startsWith(root)));

describe('the Documents face says no git word', () => {
  it('keeps the Changes page, the turn card and saved versions copy free of git words', () => {
    const offenders = documentsCopy()
      .filter((copy) => GIT_WORDS.test(copy.text))
      .map((copy) => describeCopy({ copy }));

    expect(offenders).toEqual([]);
  });

  it('scans the Changes page at all', () => {
    expect(documentsCopy().length).toBeGreaterThan(10);
  });

  it('names a Documents folder in the rail without a git word', () => {
    expect(folderFaceLineOf({ purpose: 'documents' })).not.toMatch(GIT_WORDS);
    expect(folderFaceLineOf({ purpose: null })).not.toMatch(GIT_WORDS);
  });

  it('names and explains the Documents face at pick, on Home and in Folders without a git word', () => {
    const faceCopy = [
      ...Object.values(FOLDER_FACE_COPY.documents),
      FOLDER_FACE_COPY.documentsReadOnly,
      FOLDER_FACE_COPY.documentsSaved,
      FOLDER_FACE_COPY.inPlaceTrust,
      FOLDER_FACE_COPY.pickBlock,
    ];

    expect(faceCopy.filter((line) => GIT_WORDS.test(line))).toEqual([]);
  });

  it('describes a Documents folder on the overview without a git word', () => {
    const copy = folderCardCopyOf({ purpose: 'documents', counts: undefined });

    expect([copy.face, copy.changes, copy.readOnly].join(' ')).not.toMatch(GIT_WORDS);
  });
});
