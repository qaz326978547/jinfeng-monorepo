import { loadOpenApiSpec } from '../src/infrastructure/openapi/load-spec';

async function main(): Promise<void> {
  const document = await loadOpenApiSpec();
  const pathCount = Object.keys(document.paths ?? {}).length;
  console.log(
    `[openapi:validate] OK: ${document.info.title} ${document.info.version} (${pathCount} paths)`,
  );
}

main().catch((error: unknown) => {
  console.error('[openapi:validate] failed:', error);
  process.exitCode = 1;
});
