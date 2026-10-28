import { pushFailureDigest } from '../utils/pushFailureDigest';

type Props = {
  readonly output: string;
};

const VISIBLE_LINES = 8;

export const PushFailureBlock = ({ output }: Props) => {
  const digest = pushFailureDigest({ output });
  const shown = digest.findings.slice(0, VISIBLE_LINES);
  const hidden = digest.findings.length - shown.length;
  const text =
    shown.length > 0 ? shown.join('\n') : (digest.verdict ?? output.split('\n')[0] ?? '');
  return (
    <div data-slot="push-failure" className="flex min-w-0 flex-col gap-1 text-meta">
      {digest.check !== null && (
        <p className="min-w-0 text-foreground">{`${digest.check} failed`}</p>
      )}
      <pre className="min-w-0 whitespace-pre-wrap break-words text-muted-foreground">{text}</pre>
      {hidden > 0 && (
        <p className="text-faint-foreground">{`${hidden} more ${hidden === 1 ? 'line' : 'lines'} in the full output`}</p>
      )}
    </div>
  );
};
