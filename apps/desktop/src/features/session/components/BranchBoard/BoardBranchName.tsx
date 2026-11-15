import { Tooltip } from '@goodboy/ui';
import { splitMiddleOf } from '../../central/board/splitMiddleOf';

type Props = {
  readonly name: string;
};

export const BoardBranchName = ({ name }: Props) => {
  const { head, tail } = splitMiddleOf({ text: name });
  if (tail === '') {
    return <span className="min-w-0 truncate text-code text-foreground">{name}</span>;
  }
  return (
    <Tooltip content={name}>
      <span data-board-middle="" className="flex min-w-0 text-code text-foreground">
        <span className="min-w-0 truncate">{head}</span>
        <span className="shrink-0">{tail}</span>
      </span>
    </Tooltip>
  );
};
