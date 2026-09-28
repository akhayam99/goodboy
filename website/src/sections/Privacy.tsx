import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { S26 } from '../figures';
import { SITE } from '../site';

export const Privacy = () => (
  <Block
    id="privacy"
    headingId="h2-privacy"
    heading="No account, no server"
    sub="Your tasks, decisions and settings live on your computer. Prompts go to the provider you picked, and your tool keys stay with Goodboy."
    isAlt
  >
    <div className="stackText">
      <p>
        Paste a token into a saved script and Goodboy flags it, and an export of your setup leaves
        that script out unless you say otherwise.
      </p>
      <div className="linkRow">
        <More href={SITE.privacy}>Read the full pledge</More>
        <SeeHow anchor="security-findings" />
      </div>
    </div>
    <Shot figure={S26} />
  </Block>
);
