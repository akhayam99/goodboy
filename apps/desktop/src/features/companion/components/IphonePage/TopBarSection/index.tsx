import { SectionLabel, Switch } from '@goodboy/ui';
import { useIphoneBarIconStore } from '../../../iphoneBarIconStore';

export const TopBarSection = () => {
  const isShown = useIphoneBarIconStore((state) => state.isShown);
  const setShown = useIphoneBarIconStore((state) => state.setShown);
  return (
    <section aria-label="Top bar" className="flex flex-col gap-2">
      <SectionLabel label="Top bar" headingLevel={2} />
      <Switch
        label="Show iPhone in the top bar"
        ariaLabel="Show iPhone in the top bar"
        checked={isShown}
        onChange={(isOn) => setShown({ isShown: isOn })}
      />
    </section>
  );
};
