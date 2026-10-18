import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { PaletteEntry } from '../palette/types';
import { GUIDE_CHAPTERS } from './components/GuideStudio/guideChapters';
import { openGuideChapter } from './openGuideChapter';

export const guidePaletteEntries = (): ReadonlyArray<PaletteEntry> =>
  GUIDE_CHAPTERS.map((chapter) => ({
    key: `guide:${chapter.id}`,
    label: `Guide: ${chapter.title}`,
    kind: 'page',
    group: 'help',
    icon: CONCEPT_ICONS.guide,
    tag: 'Guide',
    run: () => openGuideChapter({ id: chapter.id }),
  }));
