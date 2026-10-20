import type { FactCardSpec } from '@goodboy/ui';
import { factStateToneOf } from '../../shared/utils/factStateToneOf';
import type { ArtifactState } from './artifactStateOf';

type Params = {
  readonly state: ArtifactState;
};

export const artifactStateCardOf = ({ state }: Params): FactCardSpec => ({
  title: state.label,
  ...(state.detail === null
    ? {}
    : { state: { tone: factStateToneOf({ tone: state.tone }), words: state.detail } }),
  facts: [],
  ...(state.reason === '' ? {} : { footnote: state.reason }),
});
