import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { S25 } from '../figures';

export const Housekeeping = () => (
  <Block
    headingId="h2-house"
    heading="It cleans up after itself"
    sub="Branches and working copies pile up. Goodboy shows what each one weighs, which session made it and which are safe to delete, squash-merged branches included."
  >
    <div className="stackText">
      <p>A deleted branch can come back for 14 days.</p>
      <div className="linkRow">
        <SeeHow anchor="storage" />
      </div>
    </div>
    <Shot figure={S25} />
  </Block>
);
