import { AnchoredPopover, Button, useDropdown } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import type { useOverviewModel } from '../SessionOverviewPane/useOverviewModel';
import { DeskColumn } from './DeskColumn';
import { deskStatusLineOf } from './deskStatusLineOf';

type Props = {
  readonly session: Session;
  readonly model: ReturnType<typeof useOverviewModel>;
};

export const DeskStatusRow = ({ session, model }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: 520,
    expectedWidth: 320,
    width: 'w-80 max-w-[calc(100vw-2rem)]',
  });
  const line = deskStatusLineOf({
    needsYou: model.moves.needsYou.length + model.looseQuestions.length,
    now: model.nowCount,
    next: model.moves.next.length,
    status: model.status,
  });
  return (
    <div data-desk-status-row="" className="flex min-w-0 shrink-0 items-center">
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel={line}
        anchorClassName="min-w-0"
        trigger={
          <Button
            variant="quiet"
            size="sm"
            aria-expanded={dropdown.open}
            onClick={dropdown.toggle}
            className="min-w-0 font-normal"
          >
            <span className="min-w-0 truncate">{line}</span>
          </Button>
        }
      >
        <DeskColumn session={session} model={model} isInPopover />
      </AnchoredPopover>
    </div>
  );
};
