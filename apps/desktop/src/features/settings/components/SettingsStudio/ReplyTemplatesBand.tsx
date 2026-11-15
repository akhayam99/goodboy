import { useEffect, useState } from 'react';
import { Band, Button } from '@goodboy/ui';
import {
  REPLY_TEMPLATE_VARIABLES,
  replyTemplateProblems,
  type ReplyTemplateVariable,
} from '../../../resolve/renderReplyTemplate';
import type { SettingSave } from '../../hooks/useSettingSave';
import { settingRowKeyOfField } from '../../settingRowKeyOfField';
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

type Props = {
  readonly saves: Readonly<Record<ReplyTemplateKey, SettingSave<string>>>;
};

type DraftParams = {
  readonly key: ReplyTemplateKey;
  readonly next: string;
};

type InsertParams = {
  readonly name: ReplyTemplateVariable;
};

export const ReplyTemplatesBand = ({ saves }: Props) => {
  const fixed = saves.replyTemplateFixed.value;
  const noChange = saves.replyTemplateNoChange.value;
  const [fixedDraft, setFixedDraft] = useState(fixed);
  const [noChangeDraft, setNoChangeDraft] = useState(noChange);
  const [target, setTarget] = useState<ReplyTemplateKey>('replyTemplateFixed');

  useEffect(() => {
    setFixedDraft(fixed);
  }, [fixed]);

  useEffect(() => {
    setNoChangeDraft(noChange);
  }, [noChange]);

  const drafts: Readonly<Record<ReplyTemplateKey, string>> = {
    replyTemplateFixed: fixedDraft,
    replyTemplateNoChange: noChangeDraft,
  };
  const setters: Readonly<Record<ReplyTemplateKey, (next: string) => void>> = {
    replyTemplateFixed: setFixedDraft,
    replyTemplateNoChange: setNoChangeDraft,
  };

  const save = ({ key, next }: DraftParams) => {
    if (next === saves[key].value || replyTemplateProblems({ template: next }).length > 0) {
      return;
    }
    void saves[key].save({ value: next });
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
          rowKey={settingRowKeyOfField({ field: key }) ?? key}
          draft={drafts[key]}
          isDisabled={saves[key].isSaving}
          save={saves[key]}
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
              disabled={saves[target].isSaving}
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
