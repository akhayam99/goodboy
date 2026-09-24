export const m172StepSize = `
ALTER TABLE steps ADD COLUMN size TEXT CHECK (size IS NULL OR size IN ('small', 'medium', 'large'));
`;
