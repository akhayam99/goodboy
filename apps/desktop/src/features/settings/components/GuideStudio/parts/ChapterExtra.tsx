import type { GuideExtra } from '../guideChapters';
import { LegendSection } from './LegendSection';
import { ListensExtra } from './ListensExtra';
import { ShortcutsExtra } from './ShortcutsExtra';
import { StagesExtra } from './StagesExtra';

type Props = {
  readonly extra: GuideExtra | undefined;
};

export const ChapterExtra = ({ extra }: Props) => {
  switch (extra) {
    case 'stages':
      return <StagesExtra />;
    case 'shortcuts':
      return <ShortcutsExtra />;
    case 'listens':
      return <ListensExtra />;
    case 'legend':
      return <LegendSection />;
    case undefined:
      return null;
    default: {
      const unreachable: never = extra;
      return unreachable;
    }
  }
};
