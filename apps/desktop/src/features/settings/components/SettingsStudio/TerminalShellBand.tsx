import { useEffect, useState } from 'react';
import { Band, Button, Notice } from '@goodboy/ui';
import { AUTOMATIC_TERMINAL_SHELL, SETTING_TERMINAL_SHELL } from '../../settings';
import { useAppStore } from '../../../../store';
import { ToolChoiceField, type ToolChoice } from './ToolChoiceField';

type ShellChoiceSource = {
  readonly id: string;
  readonly label: string;
  readonly isDefault: boolean;
};

type AutomaticParams = {
  readonly shells: ReadonlyArray<ShellChoiceSource>;
};

const automaticLabel = ({ shells }: AutomaticParams): string => {
  const first = shells.find((shell) => shell.isDefault);
  return first === undefined ? 'Automatic' : `Automatic (${first.label})`;
};

export const TerminalShellBand = () => {
  const detectedShells = useAppStore((s) => s.detectedShells);
  const loadDetectedShells = useAppStore((s) => s.loadDetectedShells);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const reportError = useAppStore((s) => s.reportError);
  const [shellId, setShellId] = useState(AUTOMATIC_TERMINAL_SHELL);
  const [isLooking, setIsLooking] = useState(false);

  useEffect(() => {
    if (detectedShells === null) {
      void loadDetectedShells({ isRescan: false });
    }
  }, [detectedShells, loadDetectedShells]);

  useEffect(() => {
    void loadSetting(SETTING_TERMINAL_SHELL).then((value) =>
      setShellId(value ?? AUTOMATIC_TERMINAL_SHELL),
    );
  }, [loadSetting]);

  const onChange = async (id: string): Promise<void> => {
    try {
      await saveSetting(SETTING_TERMINAL_SHELL, id);
      setShellId(id);
    } catch (error) {
      void reportError({ title: "Couldn't save the terminal shell", error });
    }
  };

  const lookAgain = async (): Promise<void> => {
    setIsLooking(true);
    try {
      await loadDetectedShells({ isRescan: true });
    } finally {
      setIsLooking(false);
    }
  };

  const shells = detectedShells ?? [];
  const automatic = automaticLabel({ shells });
  const isMissing =
    detectedShells !== null &&
    shellId !== AUTOMATIC_TERMINAL_SHELL &&
    !shells.some((shell) => shell.id === shellId);
  const choices: ReadonlyArray<ToolChoice> = [
    { value: AUTOMATIC_TERMINAL_SHELL, label: automatic },
    ...shells.map((shell) => ({ value: shell.id, label: shell.label })),
    ...(isMissing ? [{ value: shellId, label: shellId }] : []),
  ];

  return (
    <Band inset="content" label="Terminal" headingLevel={2}>
      <div className="flex flex-col gap-2">
        <ToolChoiceField
          label="Shell"
          help="New terminals and workspace scripts start in this shell."
          value={shellId}
          choices={choices}
          onChange={(id) => void onChange(id)}
        />
        {isMissing ? (
          <Notice
            tone="warning"
            placement="inline"
            title={`${shellId} is not on this computer any more. New terminals use ${automatic} until you pick another.`}
          />
        ) : null}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" disabled={isLooking} onClick={() => void lookAgain()}>
            Look for shells again
          </Button>
        </div>
      </div>
    </Band>
  );
};
