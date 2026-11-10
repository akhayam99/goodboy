import { ToastProvider } from '../../../../../shared/components/Toast';
import { HelpStudio } from '../../../HelpStudio';
import { requestGuideChapter } from '../../../../../features/settings/components/GuideStudio/guideChapterRequest';
import { FramedStudioScene } from '../u23/FramedStudioScene';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

const CHAPTER = sceneParam({ key: 'chapter' });

if (CHAPTER !== null) {
  requestGuideChapter(CHAPTER);
}

export const GuideScene = () => (
  <ToastProvider>
    <FramedStudioScene kind="guide" place="guide">
      <HelpStudio initialTab="guide" onClose={noop} onOpenScreen={noop} />
    </FramedStudioScene>
  </ToastProvider>
);
