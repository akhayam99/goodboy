import { ToastProvider } from '../../../../../shared/components/Toast';
import { GuideStudio } from '../../../../../features/settings/components/GuideStudio';
import { requestGuideChapter } from '../../../../../features/settings/components/GuideStudio/guideChapterRequest';
import { sceneParam } from './sceneParams';

const noop = () => undefined;

const CHAPTER = sceneParam({ key: 'chapter' });

if (CHAPTER !== null) {
  requestGuideChapter(CHAPTER);
}

export const GuideScene = () => (
  <ToastProvider>
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <GuideStudio onClose={noop} />
    </main>
  </ToastProvider>
);
