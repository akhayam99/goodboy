import type { SessionStage } from '@goodboy/types';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../../session/session-stage';
import { Block } from './Block';
import { DefinitionList } from './DefinitionList';
import { StageGlyph } from './StageGlyph';

const STAGE_ORDER: ReadonlyArray<SessionStage> = [
  'building',
  'running',
  'attention',
  'review',
  'done',
];

const asSentence = ({ text }: { readonly text: string }): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

type Props = Record<never, never>;

export const StagesExtra = ({}: Props) => (
  <Block title="The columns, left to right">
    <DefinitionList
      rows={STAGE_ORDER.map((stage) => ({
        term: SESSION_STAGE_META[stage].label,
        desc: asSentence({ text: SESSION_STAGE_META[stage].reason }),
        icon: <StageGlyph stage={stage} />,
        tone: STAGE_TONE[stage],
      }))}
    />
  </Block>
);
