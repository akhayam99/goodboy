import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { STORAGE } from '../figures';
import { SITE } from '../site';

export const Storage = () => (
  <Block
    id="privacy"
    headingId="h2-privacy"
    heading="Storage and security"
    sub="No account, no server. Your tasks, decisions and settings live on your computer, and prompts go to the provider you picked."
  >
    <Shot figure={STORAGE} />
    <div className="stackText">
      <p>
        Working copies pile up. Goodboy shows what each one weighs, which session made it and which
        are safe to remove, and clears them in one click. A deleted branch can come back for 14
        days.
      </p>
      <p>
        Paste a token into a saved script and Goodboy flags it. An export of your setup leaves that
        script out unless you say otherwise.
      </p>
      <div className="linkRow">
        <More href={SITE.privacy}>Read the full pledge</More>
        <SeeHow anchor="storage" />
      </div>
    </div>
  </Block>
);
