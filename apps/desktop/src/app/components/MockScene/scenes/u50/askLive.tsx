import type { ComponentType } from 'react';
import { AskLiveScene } from './AskLiveScene';

export const U50_ASK_LIVE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u50-ask-live-light': () => <AskLiveScene theme="light" question="none" />,
  'u50-ask-live-dark': () => <AskLiveScene theme="dark" question="none" />,
  'u50-ask-live-doing-light': () => <AskLiveScene theme="light" question="doing" />,
  'u50-ask-live-doing-dark': () => <AskLiveScene theme="dark" question="doing" />,
  'u50-ask-live-left-light': () => <AskLiveScene theme="light" question="left" />,
  'u50-ask-live-left-dark': () => <AskLiveScene theme="dark" question="left" />,
};
