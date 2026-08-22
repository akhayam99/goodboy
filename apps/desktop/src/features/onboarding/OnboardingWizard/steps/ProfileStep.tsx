import { useState } from 'react';
import { Code2, UserRound, X } from 'lucide-react';
import { Input, Tooltip, cn } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { PROFILE_DISCIPLINES } from '../../../../shared/lib/profileDisciplines';

export type ProfileDraft = {
  readonly role: 'developer' | 'non-developer' | null;
  readonly discipline: string | null;
  readonly topics: ReadonlyArray<string>;
};

const ROLE_OPTIONS = [
  {
    value: 'developer',
    icon: Code2,
    label: 'I write code',
    hint: 'Diffs, branches, and pull requests stay front and center.',
  },
  {
    value: 'non-developer',
    icon: CONCEPT_ICONS.agents,
    label: 'I do not write code',
    hint: 'Agents explain their work as outcomes instead of raw diffs.',
  },
] as const;

type Props = {
  readonly draft: ProfileDraft;
  readonly onDraftChange: (draft: ProfileDraft) => void;
};

export const ProfileStep = ({ draft, onDraftChange }: Props) => {
  const [topicInput, setTopicInput] = useState('');

  const addTopic = () => {
    const topic = topicInput.trim();
    if (topic.length === 0 || draft.topics.includes(topic)) {
      setTopicInput('');
      return;
    }
    onDraftChange({ ...draft, topics: [...draft.topics, topic] });
    setTopicInput('');
  };

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
        <UserRound size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">How do you work?</h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Goodboy tailors what agents say and where they aim to who you are. You can change this any
          time in workspace settings.
        </p>
      </div>

      <div className="flex w-full flex-col gap-5 text-left">
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Role">
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={draft.role === option.value}
              onClick={() => onDraftChange({ ...draft, role: option.value })}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-3 text-left motion-safe:transition-colors',
                draft.role === option.value
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-primary/5',
              )}
            >
              <span className="mt-0.5 shrink-0 text-primary">
                <option.icon size={16} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </button>
          ))}
        </div>

        {draft.role !== null ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-foreground">Closest to your work</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Discipline">
              {PROFILE_DISCIPLINES.map((discipline) => (
                <button
                  key={discipline.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.discipline === discipline.value}
                  onClick={() =>
                    onDraftChange({
                      ...draft,
                      discipline: draft.discipline === discipline.value ? null : discipline.value,
                    })
                  }
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-colors',
                    draft.discipline === discipline.value
                      ? 'border-primary/60 bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  {discipline.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {draft.role !== null ? (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="onboarding-profile-topics"
              className="text-xs font-medium text-foreground"
            >
              Topics you care about
            </label>
            {draft.topics.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {draft.topics.map((topic) => (
                  <span
                    key={topic}
                    className="flex items-center gap-1 rounded-full border border-border-soft/60 bg-subtle/40 px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {topic}
                    <Tooltip content={`Remove ${topic}`}>
                      <button
                        type="button"
                        aria-label={`Remove ${topic}`}
                        onClick={() =>
                          onDraftChange({
                            ...draft,
                            topics: draft.topics.filter((candidate) => candidate !== topic),
                          })
                        }
                        className="text-muted-foreground/70 hover:text-foreground"
                      >
                        <X size={11} aria-hidden />
                      </button>
                    </Tooltip>
                  </span>
                ))}
              </div>
            ) : null}
            <Input
              id="onboarding-profile-topics"
              value={topicInput}
              placeholder="design systems, billing, onboarding…"
              onChange={(event) => setTopicInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  addTopic();
                }
              }}
              onBlur={addTopic}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
