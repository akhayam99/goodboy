import { TESTFLIGHT_LINK } from '../../testflightLink';
import { IphoneIntro } from './IphoneIntro';
import { PhonePreview } from './PhonePreview';
import { TestflightBlock } from './TestflightBlock';

type Props = {
  readonly link?: string;
};

export const IphoneEmpty = ({ link = TESTFLIGHT_LINK }: Props) => (
  <div className="flex items-start gap-8">
    <div className="flex min-w-0 flex-1 flex-col gap-8">
      <IphoneIntro />
      <TestflightBlock link={link} />
    </div>
    <PhonePreview />
  </div>
);
