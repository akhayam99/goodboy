import { rowFixLineOf } from '../../rowFixCopy';
import type { RowFix } from '../../rowFix';

type Props = {
  readonly fix: RowFix;
};

export const RowFixLine = ({ fix }: Props) => (
  <span
    data-row-fix={fix.kind}
    className="flex h-5 min-w-0 items-center text-meta text-muted-foreground"
  >
    <span className="min-w-0 truncate">{rowFixLineOf({ fix })}</span>
  </span>
);
