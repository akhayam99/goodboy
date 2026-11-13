import { openLink } from '../../../open/openLink';
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
          onClick={() =>
            openLink({ url: PR_URL({ number: pr }), sessionId: null, place: 'outside' })
          }
          className="text-meta text-faint-foreground hover:text-muted-foreground hover:underline"
        >
          #{pr}
        </button>
      ))}
    </span>
  );
};
