import { Notice, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { PushFailureBlock } from '../../../../shared/components/PushFailureBlock';
import { PushFixAgentAction } from '../../../../shared/components/PushFixAgentAction';
import { PrPushFailedError } from '../../../../store/slices/github/PrPushFailedError';
import type { CreateReviewNouns } from './types';

type Draft = {
  readonly title: string;
  readonly body: string;
  readonly base: string;
  readonly isDraft: boolean;
};

type Props = {
  readonly sessionId: SessionId;
  readonly nouns: CreateReviewNouns;
  readonly error: unknown;
  readonly draft: Draft;
  readonly onRetry: () => void;
};

type PendingParams = {
  readonly nouns: CreateReviewNouns;
  readonly draft: Draft;
};

const pendingOf = ({ nouns, draft }: PendingParams): string => {
  const base = draft.base.trim();
  const body = draft.body.trim();
  return `Open ${draft.isDraft ? 'a draft' : 'a'} ${nouns.long} titled "${draft.title.trim()}"${base === '' ? '' : ` into ${base}`} with this description:\n${body === '' ? '(empty)' : body}`;
};

export const CreateFailureNotice = ({ sessionId, nouns, error, draft, onRetry }: Props) => {
  const title = `Couldn't open the ${nouns.long}`;
  if (!(error instanceof PrPushFailedError)) {
    return (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title={title}
        body="The text is kept."
        detail={formatError(error)}
      />
    );
  }
  return (
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title={title}
      body={
        <div className="flex min-w-0 flex-col gap-2">
          <p>The text is kept.</p>
          <PushFailureBlock output={error.output} />
        </div>
      }
      actions={
        <PushFixAgentAction
          sessionId={sessionId}
          mountId={error.mountId}
          output={error.output}
          pending={pendingOf({ nouns, draft })}
          onSettled={onRetry}
        />
      }
    />
  );
};
