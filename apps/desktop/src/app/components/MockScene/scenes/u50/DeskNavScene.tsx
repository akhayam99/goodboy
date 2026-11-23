import { useState } from 'react';
import {
  deskLines,
  type DeskLine,
} from '../../../../../features/session/components/SessionDesk/useDeskOwner/deskLines';
import { COLUMN_SESSION_ID } from '../u26/centralColumnSeed';
import { DeskFaceScene } from './DeskFaceScene';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly line: DeskLine;
};

export const DeskNavScene = ({ theme, line }: Props) => {
  useState(() => {
    deskLines.reset();
    deskLines.noteHolder({
      sessionId: COLUMN_SESSION_ID,
      holder: line === 'closed' ? null : 'win-2',
    });
    deskLines.show({ sessionId: COLUMN_SESSION_ID, line });
    return line;
  });
  return <DeskFaceScene theme={theme} face="overview" />;
};
