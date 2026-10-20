import type { Fact, FactCardSpec } from '@goodboy/ui';
import type { FileDiff } from '@goodboy/types';
import { STATUS_WORD, splitPath } from './fileStatus';

type Params = {
  readonly file: FileDiff;
};

export const fileCardOf = ({ file }: Params): FactCardSpec => {
  const { dir, name } = splitPath(file.path);
  const facts: Array<Fact> = [{ label: 'Status', value: STATUS_WORD[file.status] }];
  if (dir !== '') {
    facts.push({ label: 'Folder', value: dir.slice(0, -1) });
  }
  if (file.status === 'renamed' && file.oldPath !== undefined) {
    facts.push({ label: 'From', value: file.oldPath });
  }
  return { title: name, facts };
};
