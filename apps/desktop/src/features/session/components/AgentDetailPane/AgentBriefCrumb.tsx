import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';
import type { AgentTaskLabel } from '../../../auto/agentTaskLabelOf';
import { MiddleText } from '../../../../shared/components/MiddleText';
import { firstLineOf } from './firstLineOf';

type Props = {
  readonly brief: string;
  readonly task: AgentTaskLabel | null;
  readonly label: string | null;
  readonly onRename: () => void;
};

const LAST_WORD = /\s[^\s…]+$/;

export const AgentBriefCrumb = ({ brief, task, label, onRename }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: 240,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
  });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Full brief"
      className="max-h-72"
      anchorClassName="flex min-w-0"
      trigger={
        <Button
          variant="ghost"
          size="xs"
          aria-label={dropdown.open ? 'Hide full brief' : 'Read full brief'}
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          onDoubleClick={onRename}
          className="min-w-0 max-w-full px-1"
        >
          {task === null ? (
            <span className="min-w-0 truncate">
              {label ?? firstLineOf({ text: brief }) ?? brief}
            </span>
          ) : (
            <span data-agent-task-crumb="" className="flex min-w-0 items-center gap-1">
              <span className="shrink-0">{task.role}</span>
              <span aria-hidden className="shrink-0 text-muted-foreground">
                ·
              </span>
              <span className="flex min-w-0">
                <MiddleText value={task.title} tail={LAST_WORD} />
              </span>
            </span>
          )}
        </Button>
      }
    >
      <p className="whitespace-pre-wrap break-words p-3 text-meta text-foreground">{brief}</p>
    </AnchoredPopover>
  );
};
