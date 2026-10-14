import { Button, Notice } from '@goodboy/ui';

type Props = {
  readonly onKeep: () => void;
};

export const KeepDraftNotice = ({ onKeep }: Props) => (
  <Notice
    tone="warning"
    placement="floating"
    role="status"
    title="Keep this draft?"
    body="Your goal and choices wait in New session. Discard draft removes them."
    actions={
      <Button variant="primary" size="sm" onClick={onKeep}>
        Keep draft
      </Button>
    }
  />
);
