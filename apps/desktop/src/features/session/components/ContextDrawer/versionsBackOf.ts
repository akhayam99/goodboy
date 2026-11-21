import type { DrawerBack } from '@goodboy/ui';
import type {
  ContextDrawerSection,
  ContextDrawerView,
} from '../../../../store/slices/drawer/state';
import { CONTEXT_SECTION_LABEL } from './contextSections';

type Params = {
  readonly view: ContextDrawerView;
  readonly section: ContextDrawerSection;
  readonly onBack: () => void;
};

export const versionsBackOf = ({ view, section, onBack }: Params): DrawerBack | undefined =>
  view === 'versions'
    ? { label: `Back to ${CONTEXT_SECTION_LABEL[section]}`, onBack, isSubview: true }
    : undefined;
