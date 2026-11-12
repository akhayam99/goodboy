import type { ComponentType } from 'react';
import { ChatRoomScene } from '../ChatRoomScene';
import { SessionAskScene } from '../SessionAskScene';
import { StartPageScene } from '../u27/startPage/StartPageScene';
import { StartRunScene } from '../u28/StartRunScene';
import { C07AutoFrame } from '../u25/c07/C07AutoFrame';
import { P10ChildComposerScene } from '../u36/P10ChildComposerScene';
import { ThemedScene } from './ThemedScene';

const NO_CLICKS: ReadonlyArray<string> = [];

export const U37_COMPOSER_SCENES = {
  'u37-composer-agent-light': () => <P10ChildComposerScene theme="light" />,
  'u37-composer-agent-dark': () => <P10ChildComposerScene theme="dark" />,
  'u37-composer-auto-light': () => (
    <ThemedScene theme="light">
      <C07AutoFrame seed={{ state: 'answering', place: 'auto' }} />
    </ThemedScene>
  ),
  'u37-composer-auto-dark': () => (
    <ThemedScene theme="dark">
      <C07AutoFrame seed={{ state: 'answering', place: 'auto' }} />
    </ThemedScene>
  ),
  'u37-composer-chat-light': () => (
    <ThemedScene theme="light">
      <ChatRoomScene />
    </ThemedScene>
  ),
  'u37-composer-chat-dark': () => (
    <ThemedScene theme="dark">
      <ChatRoomScene />
    </ThemedScene>
  ),
  'u37-composer-ask-light': () => (
    <ThemedScene theme="light">
      <SessionAskScene state="rightnow" />
    </ThemedScene>
  ),
  'u37-composer-ask-dark': () => (
    <ThemedScene theme="dark">
      <SessionAskScene state="rightnow" />
    </ThemedScene>
  ),
  'u37-composer-start-run-light': () => (
    <ThemedScene theme="light">
      <StartRunScene text="" openLabels={NO_CLICKS} />
    </ThemedScene>
  ),
  'u37-composer-start-run-dark': () => (
    <ThemedScene theme="dark">
      <StartRunScene text="" openLabels={NO_CLICKS} />
    </ThemedScene>
  ),
  'u37-composer-new-session-light': () => (
    <ThemedScene theme="light">
      <StartPageScene draft={{ startKind: 'agent' }} />
    </ThemedScene>
  ),
  'u37-composer-new-session-dark': () => (
    <ThemedScene theme="dark">
      <StartPageScene draft={{ startKind: 'agent' }} />
    </ThemedScene>
  ),
} satisfies Readonly<Record<string, ComponentType>>;
