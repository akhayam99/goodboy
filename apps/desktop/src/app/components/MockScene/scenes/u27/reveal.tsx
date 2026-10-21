import type { ComponentType } from 'react';
import { RevealAnswerScene } from './RevealAnswerScene';
import { RevealAskScene } from './RevealAskScene';

const LANDS_MID_MS = 7200;
const LANDS_EARLY_MS = 300;
const LONG_COPIES = 3;

export const U27_REVEAL_SCENES: Readonly<Record<string, ComponentType>> = {
  'u27-reveal-mid-light': () => (
    <RevealAnswerScene
      theme="light"
      landsAfterMs={LANDS_MID_MS}
      copies={1}
      isLive
      isTable={false}
    />
  ),
  'u27-reveal-mid-dark': () => (
    <RevealAnswerScene theme="dark" landsAfterMs={LANDS_MID_MS} copies={1} isLive isTable={false} />
  ),
  'u27-reveal-long-light': () => (
    <RevealAnswerScene
      theme="light"
      landsAfterMs={LANDS_EARLY_MS}
      copies={LONG_COPIES}
      isLive
      isTable={false}
    />
  ),
  'u27-reveal-long-dark': () => (
    <RevealAnswerScene
      theme="dark"
      landsAfterMs={LANDS_EARLY_MS}
      copies={LONG_COPIES}
      isLive
      isTable={false}
    />
  ),
  'u27-reveal-still-light': () => (
    <RevealAnswerScene
      theme="light"
      landsAfterMs={LANDS_EARLY_MS}
      copies={1}
      isLive={false}
      isTable={false}
    />
  ),
  'u27-reveal-still-dark': () => (
    <RevealAnswerScene
      theme="dark"
      landsAfterMs={LANDS_EARLY_MS}
      copies={1}
      isLive={false}
      isTable={false}
    />
  ),
  'u27-reveal-table-light': () => (
    <RevealAnswerScene theme="light" landsAfterMs={LANDS_EARLY_MS} copies={1} isLive isTable />
  ),
  'u27-reveal-table-dark': () => (
    <RevealAnswerScene theme="dark" landsAfterMs={LANDS_EARLY_MS} copies={1} isLive isTable />
  ),
  'u27-reveal-ask-light': () => <RevealAskScene theme="light" landsAfterMs={LANDS_EARLY_MS} />,
  'u27-reveal-ask-dark': () => <RevealAskScene theme="dark" landsAfterMs={LANDS_EARLY_MS} />,
};
