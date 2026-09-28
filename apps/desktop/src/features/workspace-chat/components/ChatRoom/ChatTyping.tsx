import { StatusDot } from '@goodboy/ui';

type Props = {
  readonly workspaceName: string;
};

export const ChatTyping = ({ workspaceName }: Props) => (
  <p role="status" className="flex items-center gap-2 text-label text-faint-foreground">
    <StatusDot tone="neutral" size="sm" pulsing role="presentation" />
    {`Reading ${workspaceName}`}
  </p>
);
