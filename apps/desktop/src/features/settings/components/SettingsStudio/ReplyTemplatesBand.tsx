import { useEffect, useState } from 'react';
import { Band, Button } from '@goodboy/ui';
import {
  REPLY_TEMPLATE_VARIABLES,
  replyTemplateProblems,
  type ReplyTemplateVariable,
} from '../../../resolve/renderReplyTemplate';
import { ReplyTemplateField } from './ReplyTemplateField';

export type ReplyTemplateKey = 'replyTemplateFixed' | 'replyTemplateNoChange';

const TEMPLATE_KEYS = [
  'replyTemplateFixed',
  'replyTemplateNoChange',
] as const satisfies ReadonlyArray<ReplyTemplateKey>;

const TEMPLATE_LABEL: Readonly<Record<ReplyTemplateKey, string>> = {
  replyTemplateFixed: 'When fixed',
  replyTemplateNoChange: 'When not changing',
};

type SaveParams = {
  readonly key: ReplyTemplateKey;
  readonly value: string;
};

type Props = {
  readonly fixed: string;
  readonly noChange: string;
  readonly isDisabled: boolean;
  readonly onSave: (params: SaveParams) => void;
};

type DraftParams = {
  readonly key: ReplyTemplateKey;
  readonly next: string;
};

type InsertParams = {
  readonly name: ReplyTemplateVariable;
};

export const ReplyTemplatesBand = ({ fixed, noChange, isDisabled, onSave }: Props) => {
  const [fixedDraft, setFixedDraft] = useState(fixed);
  const [noChangeDraft, setNoChangeDraft] = useState(noChange);
  const [target, setTarget] = useState<ReplyTemplateKey>('replyTemplateFixed');

  useEffect(() => {
    setFixedDraft(fixed);
  }, [fixed]);

  useEffect(() => {
    setNoChangeDraft(noChange);
  }, [noChange]);

  const saved: Readonly<Record<ReplyTemplateKey, string>> = {
    replyTemplateFixed: fixed,
    replyTemplateNoChange: noChange,
  };
  const drafts: Readonly<Record<ReplyTemplateKey, string>> = {
    replyTemplateFixed: fixedDraft,
    replyTemplateNoChange: noChangeDraft,
  };
  const setters: Readonly<Record<ReplyTemplateKey, (next: string) => void>> = {
    replyTemplateFixed: setFixedDraft,
    replyTemplateNoChange: setNoChangeDraft,
  };

  const save = ({ key, next }: DraftParams) => {
    if (next === saved[key] || replyTemplateProblems({ template: next }).length > 0) {
      return;
    }
    onSave({ key, value: next });
  };

  const insert = ({ name }: InsertParams) => {
    const next = `${drafts[target].trimEnd()} {${name}}`;
    setters[target](next);
    save({ key: target, next });
  };

  return (
    <Band
      inset="content"
      label="Templates"
      ariaLabel="Templates"
      hint="What a reply says around the reason."
      headingLevel={2}
    >
      {TEMPLATE_KEYS.map((key) => (
        <ReplyTemplateField
          key={key}
          label={TEMPLATE_LABEL[key]}
          draft={drafts[key]}
          isDisabled={isDisabled}
          onDraftChange={(next) => setters[key](next)}
          onFocus={() => setTarget(key)}
          onCommit={() => save({ key, next: drafts[key] })}
        />
      ))}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-meta text-muted-foreground">
          {`Placeholders, added to ${TEMPLATE_LABEL[target]}`}
        </p>
        <div role="group" aria-label="Placeholders" className="flex flex-wrap gap-1">
          {REPLY_TEMPLATE_VARIABLES.map((name) => (
            <Button
              key={name}
              variant="secondary"
              size="xs"
              disabled={isDisabled}
              onClick={() => insert({ name })}
              className="font-mono"
            >
              {`{${name}}`}
            </Button>
          ))}
        </div>
      </div>
    </Band>
  );
};
