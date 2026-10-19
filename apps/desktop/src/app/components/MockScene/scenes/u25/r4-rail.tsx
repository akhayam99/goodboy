import { R4RailScene } from './r4RailScene';

export const U25_R4_RAIL_SCENES = {
  'r4-rail-session': () => <R4RailScene state="session" />,
  'r4-rail-cards-folded': () => <R4RailScene state="cards-folded" />,
  'r4-rail-worktree': () => <R4RailScene state="worktree" />,
  'r4-rail-tools-open': () => <R4RailScene state="tools-open" />,
  'r4-rail-narrow': () => <R4RailScene state="narrow" />,
  'r4-rail-folded': () => <R4RailScene state="folded" />,
  'r4-rail-delete': () => <R4RailScene state="delete" />,
  'r4-rail-tree': () => <R4RailScene state="tree" />,
  'r4-rail-tree-menu': () => <R4RailScene state="tree-menu" />,
};
