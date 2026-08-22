import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { WorkspaceId, WorkspaceProfile } from '@goodboy/types';
import { FieldRow, SectionHeader, Tooltip, cn, formatError } from '@goodboy/ui';
import { PROFILE_DISCIPLINES } from '../../../../shared/lib/profileDisciplines';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const EMPTY_PROFILE: WorkspaceProfile = {
  role: null,
  discipline: null,
  topics: [],
  notes: null,
};

const ROLE_OPTIONS = [
  { value: 'developer', label: 'I write code' },
  { value: 'non-developer', label: 'I do not write code' },
] as const;

export const WorkspaceProfileSection = ({ workspaceId }: Props) => {
  const profile = useAppStore(
    (s) => s.workspaces?.find((candidate) => candidate.id === workspaceId)?.profile,
  );
  const updateWorkspaceProfile = useAppStore((s) => s.updateWorkspaceProfile);
  const { showToast } = useToast();
  const [topicInput, setTopicInput] = useState('');
  const [notesDraft, setNotesDraft] = useState(profile?.notes ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNotesDraft(profile?.notes ?? '');
  }, [workspaceId, profile?.notes]);

  const current = profile ?? EMPTY_PROFILE;

  const persist = async (next: WorkspaceProfile) => {
    setBusy(true);
    try {
      await updateWorkspaceProfile({ workspaceId, profile: next });
      showToast('success', 'profile saved');
    } catch (error) {
      showToast('error', formatError(error));
    } finally {
      setBusy(false);
    }
  };

  const addTopic = () => {
    const topic = topicInput.trim();
    setTopicInput('');
    if (topic.length === 0 || current.topics.includes(topic)) {
      return;
    }
    void persist({ ...current, topics: [...current.topics, topic] });
  };

  const commitNotes = () => {
    const trimmed = notesDraft.trim();
    const next = trimmed.length === 0 ? null : trimmed;
    if (next === (current.notes ?? null)) {
      return;
    }
    void persist({ ...current, notes: next });
  };

  return (
    <section id="profile" className="flex flex-col gap-4">
      <SectionHeader
        label="Profile"
        hint="Who works in this workspace. Agents adapt what they say and where they aim."
      />
      <div className="flex flex-col">
        <FieldRow label="Role" help="Non-developers get outcomes instead of raw diffs.">
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Role">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={current.role === option.value}
                disabled={busy}
                onClick={() =>
                  void persist({
                    ...current,
                    role: current.role === option.value ? null : option.value,
                  })
                }
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium motion-safe:transition-colors',
                  current.role === option.value
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Discipline" help="Biases which project agents aim at first.">
          <div
            className="flex max-w-md flex-wrap gap-1.5"
            role="radiogroup"
            aria-label="Discipline"
          >
            {PROFILE_DISCIPLINES.map((discipline) => (
              <button
                key={discipline.value}
                type="button"
                role="radio"
                aria-checked={current.discipline === discipline.value}
                disabled={busy}
                onClick={() =>
                  void persist({
                    ...current,
                    discipline: current.discipline === discipline.value ? null : discipline.value,
                  })
                }
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium motion-safe:transition-colors',
                  current.discipline === discipline.value
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                {discipline.label}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Topics" help="Areas you care about, free-form.">
          <div className="flex max-w-md flex-col gap-1.5">
            {current.topics.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {current.topics.map((topic) => (
                  <span
                    key={topic}
                    className="flex items-center gap-1 rounded-full border border-border-soft/60 bg-subtle/40 px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {topic}
                    <Tooltip content={`Remove ${topic}`}>
                      <button
                        type="button"
                        aria-label={`Remove ${topic}`}
                        disabled={busy}
                        onClick={() =>
                          void persist({
                            ...current,
                            topics: current.topics.filter((candidate) => candidate !== topic),
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
            <input
              type="text"
              value={topicInput}
              aria-label="Add topic"
              placeholder="Add a topic and press Enter"
              disabled={busy}
              onChange={(event) => setTopicInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  addTopic();
                }
              }}
              onBlur={addTopic}
              className={cn(
                'h-8 w-56 rounded-md border border-border bg-background px-2 text-sm text-foreground motion-safe:transition-colors',
                'placeholder:text-muted-foreground/40',
                'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              )}
            />
          </div>
        </FieldRow>

        <FieldRow label="Notes" help="Anything agents should keep in mind when talking to you.">
          <textarea
            value={notesDraft}
            aria-label="Profile notes"
            placeholder="Prefers short answers, explain tradeoffs…"
            disabled={busy}
            rows={3}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={commitNotes}
            className={cn(
              'w-full max-w-md rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground motion-safe:transition-colors',
              'placeholder:text-muted-foreground/40',
              'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            )}
          />
        </FieldRow>
      </div>
    </section>
  );
};
