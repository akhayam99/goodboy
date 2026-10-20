import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { C10NewSessionScene, type C10SceneState } from '../u25/C10NewSessionScene';
import { P23_EXTRA_PRESETS, withInstructions } from './p23Seed';

type Props = {
  readonly theme: 'dark' | 'light';
};

const STATE: C10SceneState = {
  page: {
    choice: 'workflow',
    isPreset: true,
    goal: 'Make ledger posts in payments-api safe to retry end to end',
  },
  projectNames: ['payments-api', 'ledger-core'],
  openPrefix: 'Preset:',
  hasConnectedProviders: true,
};

const POLL_MS = 250;
const CARD_STEP_LABEL = /^Step 2 of 3 /;

export const P23PresetPickerScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
    const current = useAppStore.getState().phaseTemplates;
    const templates = Object.fromEntries(
      Object.entries(current).map(([workspaceId, list]) => [
        workspaceId,
        [...list.map((workflow) => withInstructions({ workflow })), ...P23_EXTRA_PRESETS],
      ]),
    );
    useAppStore.setState({ phaseTemplates: templates });
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const glyph = [...document.querySelectorAll<HTMLElement>('[data-preset-glyph]')].find(
        (candidate) => CARD_STEP_LABEL.test(candidate.getAttribute('aria-label') ?? ''),
      );
      if (glyph === undefined) {
        return;
      }
      glyph.focus();
      window.clearInterval(timer);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return <C10NewSessionScene state={STATE} />;
};
