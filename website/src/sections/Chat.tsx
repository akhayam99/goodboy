import { Block } from '../components/Block';
import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { CHAT } from '../figures';

export const Chat = () => (
  <Block
    id="chat"
    headingId="h2-chat"
    heading="And when you need it, a chat"
    sub="Every agent still has its own chat, for the moments you want to steer by hand."
    isAlt
  >
    <Shot figure={CHAT} />
    <div className="stackText">
      <p>
        Type while it works and your message waits for its turn, or send it now and interrupt. Stop
        an agent and it keeps what it wrote, with Continue one click away.
      </p>
      <p>
        Restart Goodboy or install an update, and the agents that were working pick up where they
        stopped.
      </p>
      <div className="linkRow">
        <SeeHow anchor="agents-and-chat" />
      </div>
    </div>
  </Block>
);
