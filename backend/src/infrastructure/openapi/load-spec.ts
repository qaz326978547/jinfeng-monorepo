import path from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3_1 } from 'openapi-types';

export const DEFAULT_OPENAPI_SPEC_PATH = path.resolve(
  __dirname,
  '../../../migration-spec/openapi.yaml',
);

/**
 * Validates and dereferences the migration spec's openapi.yaml. Used by
 * scripts/validate-openapi.ts; kept read-only, never writes back to
 * migration-spec/.
 */
export async function loadOpenApiSpec(
  specPath: string = DEFAULT_OPENAPI_SPEC_PATH,
): Promise<OpenAPIV3_1.Document> {
  const document = (await SwaggerParser.validate(specPath)) as OpenAPIV3_1.Document;
  return document;
}
