import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { ScrollFade } from '../ScrollFade';
import { type CellAlign } from './parseMarkdown';

const NUMBER_CELL_RE = /^[~<>+-]?\d[\d.,]*\s?[%A-Za-z]{0,3}$/;

type AlignParams = {
  readonly align: CellAlign | undefined;
};

const alignClass = ({ align }: AlignParams): string => {
  if (align === 'right') {
    return 'text-right';
  }
  if (align === 'center') {
    return 'text-center';
  }
  return 'text-left';
};

type NumberColumnParams = {
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
  readonly align: CellAlign | undefined;
  readonly index: number;
};

const isNumberColumn = ({ rows, align, index }: NumberColumnParams): boolean => {
  if (align === 'right') {
    return true;
  }
  const cells = rows.map((row) => (row[index] ?? '').trim()).filter((cell) => cell.length > 0);
  return cells.length > 0 && cells.every((cell) => NUMBER_CELL_RE.test(cell));
};

type CellParams = {
  readonly text: string;
  readonly keyPrefix: string;
};

type Props = {
  readonly keyPrefix: string;
  readonly headers: ReadonlyArray<string>;
  readonly alignments: ReadonlyArray<CellAlign>;
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
  readonly renderCell: (params: CellParams) => ReactNode;
};

export const renderTable = ({
  keyPrefix,
  headers,
  alignments,
  rows,
  renderCell,
}: Props): ReactNode => {
  const numberColumns = headers.map((_, index) =>
    isNumberColumn({ rows, align: alignments[index], index }),
  );
  return (
    <ScrollFade key={keyPrefix} orientation="horizontal" fadeEdges="end" fadeSize="w-4">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border-soft">
            {headers.map((header, j) => (
              <th
                key={`${keyPrefix}-h-${j}`}
                className={cn(
                  'px-3 py-2 text-meta font-normal text-muted-foreground break-words',
                  alignClass({ align: alignments[j] }),
                  numberColumns[j] === true && 'tabular-nums',
                )}
              >
                {renderCell({ text: header, keyPrefix: `${keyPrefix}-h-${j}` })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={`${keyPrefix}-r-${ri}`}
              className="border-b border-border-soft last:border-b-0"
            >
              {row.map((cell, ci) => (
                <td
                  key={`${keyPrefix}-r-${ri}-c-${ci}`}
                  className={cn(
                    'px-3 py-2 align-top break-words',
                    alignClass({ align: alignments[ci] }),
                    numberColumns[ci] === true && 'tabular-nums',
                  )}
                >
                  {renderCell({ text: cell, keyPrefix: `${keyPrefix}-r-${ri}-c-${ci}` })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollFade>
  );
};
