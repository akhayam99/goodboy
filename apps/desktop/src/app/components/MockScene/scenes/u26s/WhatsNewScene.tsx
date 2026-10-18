import { useEffect } from 'react';
import { ChangelogStudio } from '../../../../../features/changelog/components/ChangelogStudio';
import { useAppStore } from '../../../../../store';
import { FramedStudioScene } from '../u23/FramedStudioScene';

type Variant = 'release' | 'search';

type Props = {
  readonly variant: Variant;
};

const NOOP = () => undefined;

const NEWEST_PUBLISHED_AT = Date.UTC(2026, 9, 17, 9);
const DAYS_BETWEEN_RELEASES = 2;
const MS_PER_DAY = 86_400_000;
const TYPE_AFTER_MS = 1_000;
const SEARCH_TEXT = 'export';

const seedDates = (): void => {
  const { changelogReleases } = useAppStore.getState();
  useAppStore.setState({
    changelogDates: Object.fromEntries(
      changelogReleases.map((release, index) => [
        release.version,
        new Date(NEWEST_PUBLISHED_AT - index * DAYS_BETWEEN_RELEASES * MS_PER_DAY).toISOString(),
      ]),
    ),
    changelogDatesStatus: 'ready',
    loadChangelogDates: async () => undefined,
    markChangelogSeen: async () => undefined,
  });
};

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

const WhatsNewScene = ({ variant }: Props) => {
  useEffect(() => {
    if (variant !== 'search') {
      return;
    }
    const timer = window.setTimeout(() => typeInRail({ text: SEARCH_TEXT }), TYPE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [variant]);

  return (
    <FramedStudioScene kind="changelog" place="changelog" seed={seedDates}>
      <ChangelogStudio onClose={NOOP} onOpenScreen={NOOP} />
    </FramedStudioScene>
  );
};

export const U26S_WHATS_NEW_SCENES = {
  'u26s-whatsnew-release': () => <WhatsNewScene variant="release" />,
  'u26s-whatsnew-search': () => <WhatsNewScene variant="search" />,
};
