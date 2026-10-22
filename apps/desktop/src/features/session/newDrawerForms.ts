import type { LucideIcon } from 'lucide-react';
import type { NewDrawerForm } from '../../store/slices/drawer/state';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { DRAW_WIREFRAME_CHOICE, WRITE_REPORT_CHOICE } from '../../shared/lib/startCopy';

type NewDrawerFormMeta = {
  readonly title: string;
  readonly icon: LucideIcon;
};

export const NEW_DRAWER_FORMS = {
  report: {
    title: WRITE_REPORT_CHOICE,
    icon: CONCEPT_ICONS.report,
  },
  wireframe: {
    title: DRAW_WIREFRAME_CHOICE,
    icon: CONCEPT_ICONS.wireframe,
  },
} as const satisfies Readonly<Record<NewDrawerForm, NewDrawerFormMeta>>;
