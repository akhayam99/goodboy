import { PanesScene } from './c03PanesScene';

export const U25_C03_PANE_SCENES = {
  'c03-panes-closed': () => <PanesScene state="closed" />,
  'c03-panes-ask': () => <PanesScene state="ask" />,
  'c03-panes-terminal': () => <PanesScene state="terminal" />,
  'c03-panes-explore': () => <PanesScene state="explore" />,
  'c03-panes-explore-file': () => <PanesScene state="explore-file" />,
  'c03-panes-scripts': () => <PanesScene state="scripts" />,
  'c03-panes-script-output': () => <PanesScene state="script-output" />,
  'c03-panes-context': () => <PanesScene state="context" />,
  'c03-panes-folded': () => <PanesScene state="folded" />,
  'c03-panes-drilled': () => <PanesScene state="drilled" />,
};
