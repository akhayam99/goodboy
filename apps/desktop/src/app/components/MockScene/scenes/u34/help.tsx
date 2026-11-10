import { useEffect } from 'react';
import { HelpStudio } from '../../../HelpStudio';
import { FramedStudioScene } from '../u23/FramedStudioScene';

type Variant = 'shortcuts' | 'search';

type Props = {
  readonly variant: Variant;
};

const NOOP = () => undefined;

const QUERY_OF: Readonly<Record<Variant, string>> = {
  shortcuts: '',
  search: 'search or run',
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

const HelpScene = ({ variant }: Props) => {
  useEffect(() => {
    const query = QUERY_OF[variant];
    if (query === '') {
      return;
    }
    const timer = window.setTimeout(() => typeInRail({ text: query }), TYPE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [variant]);

  return (
    <FramedStudioScene kind="guide" place="link">
      <HelpStudio
        initialTab={variant === 'shortcuts' ? 'shortcuts' : 'guide'}
        onClose={NOOP}
        onOpenScreen={NOOP}
      />
    </FramedStudioScene>
  );
};

export const U34_HELP_SCENES = {
  'u34-help-shortcuts': () => <HelpScene variant="shortcuts" />,
  'u34-help-search': () => <HelpScene variant="search" />,
};
