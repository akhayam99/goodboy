import type { ComponentType } from 'react';
import { StopSuggestScene } from './StopSuggestScene';

export const U52_STOP_SUGGEST_SCENES = {
  'u52-stop-suggest-stopped': () => <StopSuggestScene state="stopped" />,
  'u52-stop-suggest-switched': () => <StopSuggestScene state="switched" />,
  'u52-stop-suggest-deviated': () => <StopSuggestScene state="deviated" />,
} satisfies Readonly<Record<string, ComponentType>>;
