import { ToastProvider } from '../../../../../shared/components/Toast';
import { HelpStudio } from '../../../HelpStudio';
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
      <HelpStudio initialTab="guide" onClose={noop} onOpenScreen={noop} />
    </main>
  </ToastProvider>
);
