import type { ComponentType } from 'react';
import { AskPaneScene } from './AskPaneScene';

export const ASK_PANE_SCENES = {
  'ask-pane-empty': () => <AskPaneScene state="rightnow" theme="dark" />,
  'ask-pane-empty-light': () => <AskPaneScene state="rightnow" theme="light" />,
  'ask-pane-streaming': () => <AskPaneScene state="streaming" theme="dark" />,
  'ask-pane-streaming-light': () => <AskPaneScene state="streaming" theme="light" />,
  'ask-pane-answer': () => <AskPaneScene state="answer" theme="dark" />,
  'ask-pane-answer-light': () => <AskPaneScene state="answer" theme="light" />,
  'ask-pane-followup': () => <AskPaneScene state="followup" theme="dark" />,
  'ask-pane-followup-light': () => <AskPaneScene state="followup" theme="light" />,
  'ask-pane-rich': () => <AskPaneScene state="rich" theme="dark" />,
  'ask-pane-rich-light': () => <AskPaneScene state="rich" theme="light" />,
  'ask-foot': () => <AskPaneScene state="closed" theme="dark" />,
  'ask-foot-light': () => <AskPaneScene state="closed" theme="light" />,
  'ask-pane-runs': () => <AskPaneScene state="answer" theme="dark" lens="workflows" />,
  'ask-pane-runs-light': () => <AskPaneScene state="answer" theme="light" lens="workflows" />,
} satisfies Readonly<Record<string, ComponentType>>;
