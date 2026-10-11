import { useListKeys } from '../../../../shared/hooks/useListKeys';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';

type Params = {
  readonly keys: ReadonlyArray<string>;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly onOpen: (key: string) => void;
  readonly onRun: (key: string) => void;
  readonly onStop: (key: string) => void;
};

export const useScriptKeys = ({ keys, selectedKey, onSelect, onOpen, onRun, onStop }: Params) => {
  useListKeys({ keys, selectedKey, onSelect, onActivate: onOpen });
  const hasSelection = selectedKey !== null;
  useShortcut(
    'scripts.run',
    () => {
      if (selectedKey !== null) {
        onRun(selectedKey);
      }
    },
    hasSelection,
  );
  useShortcut(
    'scripts.stop',
    () => {
      if (selectedKey !== null) {
        onStop(selectedKey);
      }
    },
    hasSelection,
  );
};
