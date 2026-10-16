import type { ReactNode } from 'react';
import { SectionHeader } from '@goodboy/ui';
import type { ContextDrawerTab } from '../../../../store/slices/drawer/state';
import { CONTEXT_TAB_LABEL } from './contextTabs';

type Props = {
  readonly section: ContextDrawerTab;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

const REGION_LABEL: Readonly<Record<ContextDrawerTab, string>> = {
  ...CONTEXT_TAB_LABEL,
  learned: 'Learned in this session',
};

export const ContextSection = ({ section, action, children }: Props) => (
  <section
    aria-label={REGION_LABEL[section]}
    data-context-section={section}
    className="flex min-w-0 scroll-mt-3 flex-col gap-2"
  >
    <SectionHeader label={CONTEXT_TAB_LABEL[section]} headingLevel={2} action={action} />
    {children}
  </section>
);
