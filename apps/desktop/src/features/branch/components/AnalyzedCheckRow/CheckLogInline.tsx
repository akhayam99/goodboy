import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import type { CheckLogReading } from '../../../../store/slices/checks-log/types';
import { openLink } from '../../../open/openLink';

type Props = {
  readonly sessionId: SessionId;
  readonly url: string;
  readonly reading: CheckLogReading | null;
};

const READING = 'Reading the log';

const NO_LOG = 'GitHub gave no log for this check.';

export const CheckLogInline = ({ sessionId, url, reading }: Props) => {
  const lines = reading?.status === 'ready' ? reading.lines : [];
  return (
    <div data-check-log="" className="flex min-w-0 flex-col items-start gap-2">
      {reading === null ? (
        <span className="text-meta text-muted-foreground">{READING}</span>
      ) : lines.length === 0 ? (
        <span className="text-meta text-muted-foreground">{NO_LOG}</span>
      ) : (
        <pre className="w-full min-w-0 rounded-md bg-background p-2 font-mono text-meta break-all whitespace-pre-wrap text-muted-foreground">
          {lines.join('\n')}
        </pre>
      )}
      <Button size="sm" variant="quiet" onClick={(event) => openLink({ url, sessionId, event })}>
        {NAMES.openOnGitHub}
      </Button>
    </div>
  );
};
