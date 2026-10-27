import { Button, Notice } from '@goodboy/ui';

type Props = {
  readonly command: string;
  readonly onRunAgain: () => void;
  readonly onDismiss: () => void;
};

export const EndedCommandStrip = ({ command, onRunAgain, onDismiss }: Props) => (
  <Notice
    tone="info"
    placement="inline"
    role="status"
    title={`${command} ended when Goodboy quit`}
    actions={
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onRunAgain}>
          Run it again
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    }
  />
);
