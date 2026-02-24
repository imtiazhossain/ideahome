-- Backfill issue keys: project acronym + sequence number (1, 2, 3...) by createdAt.
-- Acronym: multiple words = first letter of each (e.g. "Idea Home Launch" -> "IHL"); single word = first 3 chars.
WITH ordered AS (
  SELECT
    i.id,
    i."projectId",
    p.name AS project_name,
    row_number() OVER (PARTITION BY i."projectId" ORDER BY i."createdAt" ASC) AS rn
  FROM "Issue" i
  JOIN "Project" p ON p.id = i."projectId"
  WHERE i.key IS NULL
),
acronym AS (
  SELECT
    id,
    rn,
    COALESCE(
      CASE
        WHEN (SELECT count(*) FROM unnest(string_to_array(trim(COALESCE(project_name, '')), ' ')) AS w) >= 2
        THEN upper((SELECT string_agg(left(t.w, 1), '') FROM unnest(string_to_array(trim(COALESCE(project_name, '')), ' ')) AS t(w)))
        ELSE nullif(upper(left(trim(COALESCE(project_name, '')), 3)), '')
      END,
      'PRJ'
    ) AS acr
  FROM ordered
)
UPDATE "Issue" i
SET key = a.acr || '-' || a.rn::text
FROM acronym a
WHERE i.id = a.id;
