import type { FileDiff } from '@goodboy/types';

export const FILE: FileDiff = {
  path: 'src/ledger/settle.ts',
  status: 'modified',
  additions: 2,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '',
      oldStart: 6,
      newStart: 6,
      oldLines: 4,
      newLines: 5,
      lines: [
        {
          kind: 'context',
          oldLine: 6,
          newLine: 6,
          text: 'export const settle = ({ posting }: Params) => {',
        },
        { kind: 'del', oldLine: 7, newLine: null, text: '  const key = posting.account;' },
        {
          kind: 'add',
          oldLine: null,
          newLine: 7,
          text: '  const creditKey = `${posting.account}:${posting.currency}`;',
        },
        {
          kind: 'add',
          oldLine: null,
          newLine: 8,
          text: '  return ledger.credit({ key: creditKey, amount: posting.amount });',
        },
        { kind: 'context', oldLine: 8, newLine: 9, text: '};' },
      ],
    },
  ],
};

const WHOLE_LINES = [
  "import { ledger } from './ledger';",
  "import type { Params } from './types';",
  '',
  'const RETRY_LIMIT = 3;',
  '',
  'export const settle = ({ posting }: Params) => {',
  '  const creditKey = `${posting.account}:${posting.currency}`;',
  '  return ledger.credit({ key: creditKey, amount: posting.amount });',
  '};',
  '',
  'export const retryLimit = () => RETRY_LIMIT;',
  '',
  'export const describe = ({ posting }: Params) => `${posting.account} for Acme`;',
];
export const WHOLE_TEXT = WHOLE_LINES.join('\n');
export const OLD_TEXT = WHOLE_TEXT.replace(
  '  const creditKey = `${posting.account}:${posting.currency}`;\n  return ledger.credit({ key: creditKey, amount: posting.amount });',
  '  const key = posting.account;',
);

export const HANDLERS = {
  worktree_file_sides: () => ({ old: OLD_TEXT, new: WHOLE_TEXT, too_large: false }),
};
