import { Copy } from '@goodboy/ui/icons';
import { Button, ICON_SIZE, useCopyLink, type CodeBlockActionsProps } from '@goodboy/ui';

export const AskCodeActions = ({ content }: CodeBlockActionsProps) => {
  const { copiedKey, copy } = useCopyLink();
  return (
    <Button variant="ghost" size="sm" onClick={() => void copy({ text: content, key: 'code' })}>
      <Copy size={ICON_SIZE.row} aria-hidden />
      {copiedKey === 'code' ? 'Copied' : 'Copy'}
    </Button>
  );
};
