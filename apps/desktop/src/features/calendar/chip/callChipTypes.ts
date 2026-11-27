import type { StatusMarkSpec } from '@goodboy/ui';
import type { AwayBanner } from '../../notifications/away/awayBannersOf';

export type CallMoment = 'five-minutes' | 'one-minute' | 'snoozed' | 'ended';

export type ArmedCall = Readonly<{
  eventId: string;
  start: number;
  end: number;
}>;

export type CallAlert = ArmedCall &
  Readonly<{
    moment: CallMoment;
  }>;

export type ChipCall = Readonly<{
  id: string;
  title: string;
  start: number;
  end: number;
  link: string;
  isLinkTrusted: boolean;
  people: ReadonlyArray<string>;
}>;

export type ChipState =
  | Readonly<{ kind: 'hidden' }>
  | Readonly<{ kind: 'soon' | 'countdown' | 'check-link'; call: ChipCall }>
  | Readonly<{ kind: 'snoozed'; call: ChipCall; until: number }>
  | Readonly<{ kind: 'in-call'; call: ChipCall; joinedAt: number }>
  | Readonly<{
      kind: 'after';
      call: ChipCall;
      joinedAt: number;
      held: ReadonlyArray<AwayBanner>;
    }>;

export type ChipAction =
  | Readonly<{ kind: 'join' | 'snooze' | 'hide' | 'return' }>
  | Readonly<{ kind: 'joined'; call: ChipCall }>
  | Readonly<{ kind: 'open'; rowKey: string }>;

export type ChipInput =
  | Readonly<{ kind: 'alert'; moment: CallMoment; call: ChipCall }>
  | Readonly<{ kind: 'ended'; call: ChipCall; held: ReadonlyArray<AwayBanner> }>
  | Readonly<{ kind: 'snoozed'; eventId: string; until: number }>
  | Readonly<{ kind: 'joined'; call: ChipCall }>
  | Readonly<{ kind: 'join' | 'snooze' | 'hide' | 'return' }>;

export type ChipEffect =
  | Readonly<{ kind: 'open-link'; call: ChipCall }>
  | Readonly<{ kind: 'snooze'; eventId: string; at: number }>
  | Readonly<{ kind: 'quiet'; eventId: string; until: number }>;

export type ChipRow = Readonly<{
  key: string;
  text: string;
  mark: StatusMarkSpec;
  canOpen: boolean;
}>;

export type ChipView =
  | Readonly<{
      kind: 'soon';
      title: string;
      start: number;
      host: string;
      rows: ReadonlyArray<ChipRow>;
    }>
  | Readonly<{
      kind: 'countdown';
      title: string;
      start: number;
      end: number;
      host: string;
      people: ReadonlyArray<string>;
    }>
  | Readonly<{ kind: 'check-link'; title: string; host: string }>
  | Readonly<{ kind: 'snoozed'; start: number; until: number }>
  | Readonly<{
      kind: 'in-call';
      title: string;
      end: number;
      joinedAt: number;
      heldCount: number;
    }>
  | Readonly<{
      kind: 'after';
      start: number;
      end: number;
      rows: ReadonlyArray<ChipRow>;
    }>;
