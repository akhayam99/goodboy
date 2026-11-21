import { Button, Notice } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly onRetry: () => void;
};

export const ArtifactLoadFailed = ({ label, onRetry }: Props) => (
  <div data-testid="artifact-load-failed" className="min-w-0">
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title={`Couldn't load ${label}`}
      actions={
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      }
    />
  </div>
);
