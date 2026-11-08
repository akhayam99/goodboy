import { Button, Notice } from '@goodboy/ui';

type Props = {
  readonly onRetry: () => void;
  readonly onOpen: () => void;
};

export const UnlinkedNotice = ({ onRetry, onOpen }: Props) => (
  <Notice
    tone="danger"
    placement="inline"
    role="alert"
    title="Couldn't link the chat to the session"
    body="The session is ready. The link between them was not saved."
    actions={
      <>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpen}>
          Open the session
        </Button>
      </>
    }
  />
);
