import type { ReactNode } from 'react';
import { EmptyLine } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../../../shared/utils/names';

type Props = {
  readonly clearFilter: ReactNode;
};

export const NothingRunningLine = ({ clearFilter }: Props) => (
  <EmptyLine icon={CONCEPT_ICONS.workflows} action={clearFilter}>
    {NAMES.nothingIsRunning}
  </EmptyLine>
);
