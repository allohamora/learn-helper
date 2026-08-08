-- Custom SQL migration file, put your code below! --
INSERT INTO "vocabulary_list" ("owner_id", "type", "title")
SELECT "id", 'personal', NULL
FROM "user" u
WHERE NOT EXISTS (
  SELECT 1 FROM "vocabulary_list" vl WHERE vl."owner_id" = u."id" AND vl."type" = 'personal'
);
--> statement-breakpoint
INSERT INTO "user_vocabulary_list" ("user_id", "vocabulary_list_id")
SELECT vl."owner_id", vl."id"
FROM "vocabulary_list" vl
WHERE vl."type" = 'personal'
  AND NOT EXISTS (
    SELECT 1 FROM "user_vocabulary_list" uvl
    WHERE uvl."user_id" = vl."owner_id" AND uvl."vocabulary_list_id" = vl."id"
  );
