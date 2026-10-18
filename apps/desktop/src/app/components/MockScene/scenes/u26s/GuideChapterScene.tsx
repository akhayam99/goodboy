import { useEffect } from 'react';
import { GuideStudio } from '../../../../../features/settings/components/GuideStudio';
import { requestGuideChapter } from '../../../../../features/settings/components/GuideStudio/guideChapterRequest';
import { FramedStudioScene } from '../u23/FramedStudioScene';

type Variant = 'chapter' | 'search' | 'monitoring';

type Props = {
  readonly variant: Variant;
};

const NOOP = () => undefined;

const SEED_OF: Readonly<Record<Variant, () => void>> = {
  chapter: () => requestGuideChapter('commits'),
  search: () => requestGuideChapter('commits'),
  monitoring: () => requestGuideChapter('monitoring'),
};

const QUERY_OF: Readonly<Record<Variant, string>> = {
  chapter: '',
  search: 'limit',
  monitoring: '',
};

const TYPE_AFTER_MS = 1_000;

type TypeParams = {
  readonly text: string;
};

const typeInRail = ({ text }: TypeParams): void => {
  const input = document.querySelector<HTMLInputElement>('[data-rail-search]');
  if (input === null) {
    return;
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const GuideChapterScene = ({ variant }: Props) => {
  useEffect(() => {
    const query = QUERY_OF[variant];
    if (query === '') {
      return;
    }
    const timer = window.setTimeout(() => typeInRail({ text: query }), TYPE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [variant]);

  return (
    <FramedStudioScene kind="guide" place="link" seed={SEED_OF[variant]}>
      <GuideStudio onClose={NOOP} />
    </FramedStudioScene>
  );
};

export const U26S_GUIDE_SCENES = {
  'u26s-guide-chapter': () => <GuideChapterScene variant="chapter" />,
  'u26s-guide-search': () => <GuideChapterScene variant="search" />,
  'u26s-guide-monitoring': () => <GuideChapterScene variant="monitoring" />,
};
