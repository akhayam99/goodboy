import { Switch } from '@goodboy/ui';
import { useIphoneBarIconStore } from '../../iphoneBarIconStore';

export const BarIconSwitch = () => {
  const isShown = useIphoneBarIconStore((state) => state.isShown);
  const setShown = useIphoneBarIconStore((state) => state.setShown);
  return (
    <Switch
      label="Show iPhone in the top bar"
      ariaLabel="Show iPhone in the top bar"
      checked={isShown}
      onChange={(isOn) => setShown({ isShown: isOn })}
    />
  );
};
