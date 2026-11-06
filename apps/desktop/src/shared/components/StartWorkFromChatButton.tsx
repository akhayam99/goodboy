import { Play } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { ChatMessageId } from '@goodboy/types';
import { NAMES } from '../utils/names';

type Props = {
  readonly messageId: ChatMessageId;
  readonly onStartWork: (messageId: ChatMessageId) => void;
  readonly label?: string;
};

export const StartWorkFromChatButton = ({
  messageId,
  onStartWork,
  label = NAMES.startWorkFromChat,
}: Props) => (
  <Button
    variant="quiet"
    size="xs"
    className="text-faint-foreground"
    onClick={() => onStartWork(messageId)}
  >
    <Play size={ICON_SIZE.row} aria-hidden />
    {label}
  </Button>
);
