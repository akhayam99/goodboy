import type { SessionStage } from '@goodboy/types';
import { ARCHIVED_LANE, describeStageBucket } from '../../../../session/session-stage';
import type { StatePresentation } from '../../../../../shared/utils/statePresentation';
import { Block } from './Block';
import { DefinitionList } from './DefinitionList';

const STAGE_ORDER: ReadonlyArray<SessionStage> = [
  'building',
  'running',
  'attention',
  'review',
  'done',
];

const LANES: ReadonlyArray<StatePresentation> = [
  ...STAGE_ORDER.map((stage) => describeStageBucket({ stage })),
  ARCHIVED_LANE,
];

const asSentence = ({ text }: { readonly text: string }): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

type Props = Record<never, never>;

export const StagesExtra = ({}: Props) => (
  <Block title="The columns, left to right">
    <DefinitionList
      rows={LANES.map(({ label, reason, tone, icon: Icon }) => ({
        term: label,
        desc: asSentence({ text: reason }),
        icon: <Icon size={11} aria-hidden />,
        tone,
      }))}
    />
  </Block>
);
