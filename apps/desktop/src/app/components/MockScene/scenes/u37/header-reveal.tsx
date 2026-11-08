import type { ComponentType } from 'react';
import { BoardScene } from '../BoardScene';
import { ChatRoomScene } from '../ChatRoomScene';
import { U25_B_MONITORING_SCENES } from '../u25/b-monitoring';
import { U25_C05_OVERVIEW_SCENES } from '../u25/c05-overview';
import { U25_C06_CONVERSATION_SCENES } from '../u25/c06-conversation';
import { U25_C08_PRESET_RUN_SCENES } from '../u25/c08-preset-run';
import { HeaderRevealScene } from './HeaderRevealScene';
import { ReadingScene } from './ReadingScene';

export const U37_HEADER_REVEAL_SCENES: Readonly<Record<string, ComponentType>> = {
  'u37-header-reveal': () => <HeaderRevealScene still="top" />,
  'u37-header-reveal-reading': () => <HeaderRevealScene still="reading" />,
  'u37-header-reveal-back': () => <HeaderRevealScene still="back" />,
  'u37-header-reveal-overview': () => (
    <ReadingScene Base={U25_C05_OVERVIEW_SCENES['c05-overview-notices']} />
  ),
  'u37-header-reveal-runs': () => <ReadingScene Base={U25_C08_PRESET_RUN_SCENES['c08-runs']} />,
  'u37-header-reveal-agent': () => (
    <ReadingScene Base={U25_C06_CONVERSATION_SCENES['c06-agent-finished']} start="top" />
  ),
  'u37-header-reveal-drawer': () => (
    <ReadingScene Base={U25_C06_CONVERSATION_SCENES['c06-agent-transcript']} scroller="last" />
  ),
  'u37-header-reveal-monitoring': () => (
    <ReadingScene Base={U25_B_MONITORING_SCENES['b-monitoring-busy']} />
  ),
  'u37-header-reveal-chat': () => <ReadingScene Base={ChatRoomScene} start="top" />,
  'u37-header-reveal-board': () => <ReadingScene Base={BoardScene} />,
};
