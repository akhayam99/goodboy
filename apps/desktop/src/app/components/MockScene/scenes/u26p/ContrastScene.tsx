import { useEffect } from 'react';
import { Band } from '@goodboy/ui';
import { switchContrast } from '../../../../../shared/lib/contrast';
import { applyDocumentTheme, type Theme } from '../../../../../shared/lib/theme';
import { ContrastPreferenceField } from '../../../../../features/settings/components/SettingsStudio/ContrastPreferenceField';

type Props = {
  readonly theme: Theme;
  readonly isMore: boolean;
};

type Row = {
  readonly name: string;
  readonly tone: string;
};

const ROWS: ReadonlyArray<Row> = [
  { name: 'payments-api', tone: 'bg-selected' },
  { name: 'ledger-core', tone: 'bg-hover' },
  { name: 'notify-relay', tone: 'text-disabled-foreground' },
];

export const ContrastScene = ({ theme, isMore }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
    switchContrast({ isOn: isMore });
    return () => switchContrast({ isOn: false });
  }, [theme, isMore]);

  return (
    <main className="flex h-screen w-screen flex-col gap-6 bg-background p-10 text-foreground">
      <Band inset="content" label="Appearance" headingLevel={2}>
        <ContrastPreferenceField />
      </Band>
      <ul className="flex w-80 flex-col gap-1 rounded-md border border-border-soft bg-subtle p-2">
        {ROWS.map((row) => (
          <li
            key={row.name}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-meta ${row.tone}`}
          >
            <span className="size-2 rounded-full bg-idle" aria-hidden />
            <span>{row.name}</span>
          </li>
        ))}
      </ul>
    </main>
  );
};

export const U26P_CONTRAST_SCENES = {
  'p26-contrast-standard-dark': () => <ContrastScene theme="dark" isMore={false} />,
  'p26-contrast-more-dark': () => <ContrastScene theme="dark" isMore />,
  'p26-contrast-more-light': () => <ContrastScene theme="light" isMore />,
};
