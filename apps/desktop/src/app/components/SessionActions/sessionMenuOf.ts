import { AUTO_LIMIT_COPY } from '../../../features/auto/autoLimitCopy';
import { NAMES } from '../../../shared/utils/names';

type Params = {
  readonly limitUsd: number | null;
};

type SessionMenu = Readonly<{
  only: ReadonlyArray<string>;
  relabel: ReadonlyMap<string, string>;
}>;

const SESSION_MENU_IDS: ReadonlyArray<string> = [
  'session.spend',
  'session.autopilotOn',
  'session.autopilotOff',
  'session.stopAll',
  'session.archive',
  'session.restore',
  'session.delete',
];

export const sessionMenuOf = ({ limitUsd }: Params): SessionMenu => ({
  only: SESSION_MENU_IDS,
  relabel: new Map([
    ['session.spend', AUTO_LIMIT_COPY.labelOf({ usd: limitUsd })],
    ['session.autopilotOn', `${NAMES.autopilot}: off`],
    ['session.autopilotOff', `${NAMES.autopilot}: on`],
  ]),
});
