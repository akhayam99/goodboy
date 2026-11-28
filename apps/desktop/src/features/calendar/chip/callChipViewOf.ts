import type { StatusMarkSpec } from '@goodboy/ui';
import { joinFacts } from '../../../shared/utils/joinFacts';
import { attentionMarkOf } from '../../session/attentionMarkOf';
import type { AwayBanner } from '../../notifications/away/awayBannersOf';
import { linkHostOf } from '../linkHostOf';
import type { ChipRow, ChipState, ChipView } from './callChipTypes';

type Params = {
  readonly state: ChipState;
  readonly waiting: ReadonlyArray<ChipRow>;
  readonly heldCount: number;
};

type HeldParams = {
  readonly held: ReadonlyArray<AwayBanner>;
};

const WAITING: StatusMarkSpec = { kind: 'dot', tone: 'warning' };

const heldRowsOf = ({ held }: HeldParams): ReadonlyArray<ChipRow> =>
  held.map((banner) => ({
    key: banner.keys[0] ?? banner.title,
    text: joinFacts({ facts: [banner.title, banner.body] }),
    mark: banner.reason === null ? WAITING : attentionMarkOf({ reason: banner.reason }),
    canOpen: banner.sessionId !== null,
  }));

export const callChipViewOf = ({ state, waiting, heldCount }: Params): ChipView | null => {
  if (state.kind === 'hidden') {
    return null;
  }
  const { call } = state;
  const host = linkHostOf({ link: call.link }) ?? call.link;
  if (state.kind === 'soon') {
    return { kind: 'soon', title: call.title, start: call.start, host, rows: waiting };
  }
  if (state.kind === 'countdown') {
    return {
      kind: 'countdown',
      title: call.title,
      start: call.start,
      end: call.end,
      host,
      people: call.people,
    };
  }
  if (state.kind === 'check-link') {
    return { kind: 'check-link', title: call.title, host };
  }
  if (state.kind === 'snoozed') {
    return { kind: 'snoozed', start: call.start, until: state.until };
  }
  if (state.kind === 'in-call') {
    return {
      kind: 'in-call',
      title: call.title,
      end: call.end,
      joinedAt: state.joinedAt,
      heldCount,
    };
  }
  if (state.kind !== 'after') {
    return null;
  }
  return {
    kind: 'after',
    start: call.start,
    end: call.end,
    rows: heldRowsOf({ held: state.held }),
  };
};
