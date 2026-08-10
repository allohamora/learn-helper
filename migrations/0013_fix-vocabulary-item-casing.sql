-- Custom SQL migration file, put your code below! --
-- Fixes vocabulary_item.value rows that were seeded lowercase for words/phrases
-- that must be capitalized in standard English (days, months, acronyms, etc.).
-- Matched by (value, part_of_speech) since that pair is the seeding dedup key.
UPDATE "vocabulary_item" AS vi
SET "value" = fix.corrected
FROM (VALUES
  ('april', 'noun', 'April'),
  ('august', 'noun', 'August'),
  ('cd', 'noun', 'CD'),
  ('december', 'noun', 'December'),
  ('dvd', 'noun', 'DVD'),
  ('february', 'noun', 'February'),
  ('friday', 'noun', 'Friday'),
  ('i', 'pronoun', 'I'),
  ('january', 'noun', 'January'),
  ('july', 'noun', 'July'),
  ('june', 'noun', 'June'),
  ('march', 'noun', 'March'),
  ('may', 'noun', 'May'),
  ('monday', 'noun', 'Monday'),
  ('november', 'noun', 'November'),
  ('october', 'noun', 'October'),
  ('ok', 'adjective', 'OK'),
  ('ok', 'adverb', 'OK'),
  ('ok', 'exclamation', 'OK'),
  ('saturday', 'noun', 'Saturday'),
  ('september', 'noun', 'September'),
  ('sunday', 'noun', 'Sunday'),
  ('t-shirt', 'noun', 'T-shirt'),
  ('thursday', 'noun', 'Thursday'),
  ('tuesday', 'noun', 'Tuesday'),
  ('tv', 'noun', 'TV'),
  ('wednesday', 'noun', 'Wednesday'),
  ('god', 'noun', 'God'),
  ('it', 'noun', 'IT'),
  ('aids', 'noun', 'AIDS'),
  ('id', 'noun', 'ID')
) AS fix(old_value, part_of_speech, corrected)
WHERE vi."value" = fix.old_value
  AND vi."part_of_speech" = fix.part_of_speech;
--> statement-breakpoint
UPDATE "vocabulary_item" AS vi
SET "value" = fix.corrected
FROM (VALUES
  ('in april', 'in April'),
  ('on monday', 'on Monday'),
  ('on tv', 'on TV'),
  ('tv show', 'TV show')
) AS fix(old_value, corrected)
WHERE vi."value" = fix.old_value
  AND vi."part_of_speech" IS NULL;
