import { isMainWindow } from '../workspace/window';
import { applyChipInput } from './chip/applyChipInput';
import { callChipCommands } from './chip/callChipCommands';
import type { ChipCall } from './chip/callChipTypes';
import { reportChipError } from './chip/reportChipError';
import { joinCall } from './joinCall';

type Params = {
  readonly link: string;
  readonly call: ChipCall | null;
};

export const joinMeeting = async ({ link, call }: Params): Promise<void> => {
  const isOpened = await joinCall({ link });
  if (!isOpened || call === null) {
    return;
  }
  if (isMainWindow()) {
    applyChipInput({ input: { kind: 'joined', call }, now: Date.now() });
    return;
  }
  try {
    await callChipCommands.act({ action: { kind: 'joined', call } });
  } catch (error) {
    reportChipError({ title: "Couldn't hold notices for this call", error });
  }
};
