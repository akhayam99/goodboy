type FilesParams = {
  readonly files: ReadonlyArray<string>;
};

export const conflictFilesLabelOf = ({ files }: FilesParams): string => {
  const [first] = files;
  if (first === undefined) {
    return 'the conflict';
  }
  return files.length === 1 ? first : `${first} and ${files.length - 1} more`;
};

type CountParams = {
  readonly count: number;
};

export const conflictCountLabelOf = ({ count }: CountParams): string =>
  `${count} ${count === 1 ? 'file' : 'files'}`;

type LineParams = {
  readonly files: ReadonlyArray<string>;
  readonly baseBranch: string;
  readonly isHook: boolean;
};

export const rebaseConflictTitleOf = ({ files, baseBranch, isHook }: LineParams): string => {
  if (isHook) {
    return `A commit hook stopped the rebase on ${baseBranch}`;
  }
  if (files.length === 0) {
    return `The rebase on ${baseBranch} hit a conflict`;
  }
  return `${conflictCountLabelOf({ count: files.length })} conflict with ${baseBranch}`;
};

export const rebaseConflictLineOf = ({ files, isHook }: Omit<LineParams, 'baseBranch'>): string =>
  isHook || files.length === 0
    ? 'Nothing changed on your branch.'
    : `${conflictFilesLabelOf({ files })}. Nothing changed on your branch.`;

export const rebaseConflictMessageOf = ({ files, baseBranch, isHook }: LineParams): string =>
  `${rebaseConflictTitleOf({ files, baseBranch, isHook })}. ${rebaseConflictLineOf({ files, isHook })}`;
