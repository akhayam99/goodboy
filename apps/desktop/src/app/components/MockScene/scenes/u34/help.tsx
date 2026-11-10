import { useEffect } from 'react';
import { HelpStudio } from '../../../HelpStudio';
import { FramedStudioScene } from '../u23/FramedStudioScene';

const NOOP = () => undefined;

const QUERY = 'palette';

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

const HelpScene = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => typeInRail({ text: QUERY }), TYPE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <FramedStudioScene kind="guide" place="guide">
      <HelpStudio
        initialTab={variant === 'shortcuts' ? 'shortcuts' : 'guide'}
        onClose={NOOP}
        onOpenScreen={NOOP}
      />
    </FramedStudioScene>
  );
};

export const U34_HELP_SCENES = {
  'u34-help-search': () => <HelpScene />,
};
