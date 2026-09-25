import { Button, CopyButton, Notice } from '@goodboy/ui';
import type { ConversationFailure } from './useConversation';

type Props = {
  readonly failure: ConversationFailure;
};

export const FailedMessageNotice = ({ failure }: Props) => (
  <Notice
    tone="danger"
    placement="inline"
    role="alert"
    title="Didn't post"
    body={failure.error}
    actions={
      <>
        <Button size="sm" variant="ghost" onClick={failure.retry}>
          Retry
        </Button>
        <CopyButton value={failure.body} label="Copy text" presentation="icon">
          Copy text
        </CopyButton>
        <Button size="sm" variant="ghost" onClick={failure.discard}>
          Discard
        </Button>
      </>
    }
  />
);
