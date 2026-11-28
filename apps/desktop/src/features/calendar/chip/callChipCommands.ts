import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { ArmedCall, ChipAction, ChipView } from './callChipTypes';

type ArmParams = {
  readonly calls: ReadonlyArray<ArmedCall>;
};

type SnoozeParams = {
  readonly eventId: string;
  readonly at: number;
};

type ShowParams = {
  readonly view: ChipView;
  readonly height: number;
};

type ResizeParams = {
  readonly height: number;
};

type ActParams = {
  readonly action: ChipAction;
};

export const callChipCommands = {
  arm: ({ calls }: ArmParams): Promise<number> =>
    invokeCommand<number>('calendar_alerts_arm', { calls }),
  snooze: ({ eventId, at }: SnoozeParams): Promise<boolean> =>
    invokeCommand<boolean>('calendar_alerts_snooze', { eventId, at }),
  show: ({ view, height }: ShowParams): Promise<void> =>
    invokeCommand<void>('calendar_chip_show', { view, height }),
  hide: (): Promise<void> => invokeCommand<void>('calendar_chip_hide'),
  view: (): Promise<ChipView | null> => invokeCommand<ChipView | null>('calendar_chip_view'),
  resize: ({ height }: ResizeParams): Promise<void> =>
    invokeCommand<void>('calendar_chip_resize', { height }),
  act: ({ action }: ActParams): Promise<void> =>
    invokeCommand<void>('calendar_chip_act', { action }),
};
