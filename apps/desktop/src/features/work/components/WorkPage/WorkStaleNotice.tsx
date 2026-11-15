import { Button, Notice } from '@goodboy/ui';

type Props = {
  readonly onRetry: () => void;
};

export const WorkStaleNotice = ({ onRetry }: Props) => (
  <Notice
    tone="warning"
    placement="inline"
    role="alert"
    title="Couldn't refresh Leads"
    detail="The list shows what was read last."
    actions={
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    }
  />
);
