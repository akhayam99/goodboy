import { useAppStore } from '../../store';
import { requestGuideChapter } from './components/GuideStudio/guideChapterRequest';

type Params = {
  readonly id: string;
};

export const openGuideChapter = ({ id }: Params): void => {
  requestGuideChapter(id);
  useAppStore.getState().openStudio({ studio: { kind: 'guide' } });
};
