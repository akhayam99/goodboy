import { TerminalScene } from './c13/TerminalScene';

export const U25_C13_TERMINAL_SCENES = {
  'c13-terminal': () => <TerminalScene state="list" />,
  'c13-terminal-other': () => <TerminalScene state="other" />,
  'c13-terminal-menu': () => <TerminalScene state="menu" />,
  'c13-terminal-workspace': () => <TerminalScene state="workspace" />,
  'c13-terminal-empty': () => <TerminalScene state="empty" />,
};
