import { Button, Notice } from '@goodboy/ui';

type Props = {
  readonly onDiscard: () => void;
  readonly onKeep: () => void;
};

export const KeepDraftNotice = ({ onDiscard, onKeep }: Props) => (
  <Notice
    tone="warning"
    placement="inline"
    role="status"
    title="Keep this draft?"
    body="Your goal and choices wait in New session."
    actions={
      <>
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          Discard
        </Button>
        <Button variant="primary" size="sm" onClick={onKeep}>
          Keep draft
        </Button>
      </>
    }
  />
);
