import { useIsDrawerParked } from '@goodboy/ui';
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
  const isParked = useIsDrawerParked();
  const isActive = selectedKey !== null && !isParked;
  useShortcut(
    'scripts.run',
    () => {
      if (selectedKey !== null) {
        onRun(selectedKey);
      }
    },
    isActive,
  );
  useShortcut(
    'scripts.stop',
    () => {
      if (selectedKey !== null) {
        onStop(selectedKey);
      }
    },
    isActive,
  );
};
