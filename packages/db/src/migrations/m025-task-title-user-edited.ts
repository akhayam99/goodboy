export const m025TaskTitleUserEdited = /* sql */ `
ALTER TABLE tasks ADD COLUMN title_user_edited INTEGER NOT NULL DEFAULT 0;
`;
