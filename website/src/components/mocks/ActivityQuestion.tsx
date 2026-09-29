import { HARBORLINE } from '../../data/harborline';

const { QUESTION } = HARBORLINE;

type Props = {
  readonly isOpen: boolean;
};

export const ActivityQuestion = ({ isOpen }: Props) => (
  <div className={isOpen ? 'mk-qslot is-open' : 'mk-qslot'} aria-hidden={isOpen ? undefined : true}>
    <div className="mk-clip">
      <div className="mk-qwrap">
        <div className="mk-q">
          <div className="mk-qlabel">{QUESTION.label}</div>
          <div className="mk-qtext">{QUESTION.text}</div>
          <div className="mk-qact">
            {QUESTION.answers.map((answer) => (
              <span key={answer} className="mk-pill">
                {answer}
              </span>
            ))}
            <span className="mk-answer">{QUESTION.action}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
