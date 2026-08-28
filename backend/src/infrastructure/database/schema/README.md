# database-schema.json

Verbatim copy of `specs/backend/migration-history/database-schema.json`,
vendored here so `scripts/verify-schema.ts` /
`src/infrastructure/database/schema-verifier.ts` do not depend on the
monorepo-level `specs/` directory at runtime (it is excluded from the Docker
build context).

Do not hand-edit this file. If the reference schema changes, regenerate it
from `specs/backend/migration-history/database-schema.json` (the spec of
record) and copy it here again.
