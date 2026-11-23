import { Button, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { actionIntentOf } from '../../../actions/actionIntentOf';
import { NAMES } from '../../../../shared/utils/names';
import { bringDeskHere } from './bringDeskHere';
import { switchSessionFace } from './switchSessionFace';
import type { DeskLine } from './useDeskOwner/deskLines';

type Props = {
  readonly sessionId: SessionId;
  readonly line: DeskLine;
};

const COPY = {
  closed: { title: NAMES.deskClosed, verb: NAMES.reopenDesk },
  'open-elsewhere': { title: NAMES.deskOpenElsewhere, verb: NAMES.bringDeskHere },
  moved: { title: NAMES.deskMovedAway, verb: NAMES.bringDeskBack },
} as const satisfies Record<DeskLine, { readonly title: string; readonly verb: string }>;

export const DeskLineNotice = ({ sessionId, line }: Props) => {
  const { title, verb } = COPY[line];
  const act = (): void => {
    if (line === 'closed') {
      switchSessionFace({ sessionId, face: 'desk' });
      return;
    }
    void bringDeskHere({ sessionId });
  };
  return (
    <Notice
      tone="info"
      placement="banner"
      role="status"
      title={title}
      actions={
        <Button
          size="sm"
          variant="secondary"
          intent={actionIntentOf({ verb })}
          onClick={act}
          data-desk-line-action=""
        >
          {verb}
        </Button>
      }
    />
  );
};
