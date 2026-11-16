import { CircleAlert } from '@goodboy/ui/icons';
import { ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import type { ToolState } from '../../model/toolStateOf';

type Props = {
  readonly toolState: ToolState;
};

export const StateWord = ({ toolState }: Props) => {
  if (toolState.tone !== 'danger') {
    return (
      <span data-tool-state={toolState.kind} className="shrink-0 text-meta text-muted-foreground">
        {toolState.word}
      </span>
    );
  }
  const tint = tintClasses(toolState.tone);
  return (
    <span
      data-tool-state={toolState.kind}
      className={cn('inline-flex shrink-0 items-center gap-1 text-meta', tint.text)}
    >
      <CircleAlert size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      {toolState.word}
    </span>
  );
};
