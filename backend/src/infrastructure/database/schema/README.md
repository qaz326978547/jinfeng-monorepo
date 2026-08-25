# database-schema.json

Verbatim copy of `migration-spec/database-schema.json`, vendored here so
`scripts/verify-schema.ts` / `src/infrastructure/database/schema-verifier.ts`
do not depend on the `migration-spec/` directory at runtime (it is excluded
from the Docker build context).

Do not hand-edit this file. If the reference schema changes, regenerate it
from `migration-spec/database-schema.json` (the spec of record) and copy it
here again.
