import { BrandMark } from '../BrandIcons';
import type { MockProvider } from '../../data/harborline';

type Props = {
  readonly provider: MockProvider;
};

export const ProviderIcon = ({ provider }: Props) => (
  <BrandMark brand={provider} size={14} className="mk-ic" isBrandColored />
);
