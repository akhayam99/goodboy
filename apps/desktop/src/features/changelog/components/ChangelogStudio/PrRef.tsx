import { openUrl } from '../../../../shared/lib/editor';
import { PR_URL } from '../../releasePrs';

type Props = {
  readonly prs: ReadonlyArray<number>;
};

export const PrRef = ({ prs }: Props) => {
  if (prs.length === 0) {
    return null;
  }
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1">
      {prs.map((pr) => (
        <button
          key={pr}
          type="button"
          onClick={() => void openUrl(PR_URL({ number: pr }))}
          className="text-2xs text-faint-foreground hover:text-muted-foreground hover:underline"
        >
          #{pr}
        </button>
      ))}
    </span>
  );
};
