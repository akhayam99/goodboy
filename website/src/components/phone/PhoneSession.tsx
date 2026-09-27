import { BrandMark, type BrandId } from '../BrandIcons';

type Chat = {
  readonly role: string;
  readonly tone: string;
  readonly task: string;
  readonly brand: BrandId;
  readonly model: string;
  readonly cost: string;
};

const CHATS: readonly Chat[] = [
  {
    role: 'Scout',
    tone: 'scout',
    task: 'Trace where a retried webhook posts',
    brand: 'cursor',
    model: 'Composer 2.5',
    cost: '$0.13',
  },
  {
    role: 'Planner',
    tone: 'planner',
    task: 'Agree where the dedupe belongs',
    brand: 'anthropic',
    model: 'Opus 5.5 · High',
    cost: '$1.28',
  },
  {
    role: 'Implementer',
    tone: 'implementer',
    task: 'Dedupe on the event id in payments-api',
    brand: 'codex',
    model: 'GPT-5.6 Sol',
    cost: '$0.94',
  },
  {
    role: 'Implementer',
    tone: 'implementer',
    task: 'Record the attempts on each delivery in notify-relay',
    brand: 'cursor',
    model: 'Kimi K3',
    cost: 'running',
  },
  {
    role: 'Tester',
    tone: 'tester',
    task: 'Replay one event three times',
    brand: 'anthropic',
    model: 'Haiku 4.5',
    cost: 'next',
  },
];

export const PhoneSession = () => (
  <div
    className="pCard"
    role="img"
    aria-label="One Harborline session with eight chats, each with a role, a provider and a model"
  >
    <div className="pHead">
      <span className="pTitle">Stop retried webhooks posting a second credit</span>
      <span className="pChips">
        <span className="pChip">
          <BrandMark brand="github" size={12} tinted={false} />
          #318 in review
        </span>
        <span className="pChip">
          <BrandMark brand="linear" size={12} />
          HBL-412
        </span>
        <span className="pChip">$3.47</span>
      </span>
    </div>
    <div className="pLabel">8 chats, 3 providers</div>
    <ul className="pRows">
      {CHATS.map((chat) => (
        <li key={chat.task}>
          <span className="pMeta">
            <span className={`pRole ${chat.tone}`}>{chat.role}</span>
            <BrandMark brand={chat.brand} size={12} />
            {chat.model}
            <span className={chat.cost.startsWith('$') ? 'pCost' : 'pCost muted'}>{chat.cost}</span>
          </span>
          <span className="pTask">{chat.task}</span>
        </li>
      ))}
    </ul>
    <span className="pMore">3 more scouts, $0.09</span>
  </div>
);
