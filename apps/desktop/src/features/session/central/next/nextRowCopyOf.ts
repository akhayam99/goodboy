import type { ActionCardModel } from './actionCardsOf';
import type { NextGroupId } from './nextGroupIds';

export type NextBranchName = Readonly<{
  branch: string;
  request: string | null;
}>;

type Params = {
  readonly row: ActionCardModel;
  readonly group: NextGroupId;
  readonly branch: NextBranchName | null;
  readonly stopLine?: string | null;
};

type RowParams = {
  readonly row: ActionCardModel;
};

const sentenceOf = ({ row }: RowParams): string | null => {
  const { source } = row;
  if (source.kind === 'auto') {
    return row.detail;
  }
  if (
    source.kind === 'suggestion' &&
    source.suggestion.kind === 'resolve-threads' &&
    row.folded.length === 0
  ) {
    const count = source.suggestion.payload.eligibleThreadCount;
    return `${count} review ${count === 1 ? 'conversation waits' : 'conversations wait'} for a fix.`;
  }
  const head = row.title.endsWith('.') ? row.title : `${row.title}.`;
  if (row.detail === null || row.detail === '') {
    return head;
  }
  const detail = `${row.detail.charAt(0).toUpperCase()}${row.detail.slice(1)}`;
  return `${head} ${detail.endsWith('.') ? detail : `${detail}.`}`;
};

type TitleParams = {
  readonly branch: NextBranchName;
};

const branchTitleOf = ({ branch }: TitleParams): string =>
  branch.request === null ? branch.branch : `${branch.branch} · ${branch.request}`;

export const nextRowCopyOf = ({ row, group, branch, stopLine = null }: Params): ActionCardModel => {
  if (branch === null) {
    return row;
  }
  if (group === 'update' && row.kind === 'rebase' && stopLine !== null) {
    return { ...row, title: branchTitleOf({ branch }), detail: stopLine };
  }
  if (group !== 'fix') {
    return row;
  }
  return { ...row, title: branchTitleOf({ branch }), detail: sentenceOf({ row }) };
};
