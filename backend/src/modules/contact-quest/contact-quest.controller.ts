import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import type { ContactQuestService } from './contact-quest.service';

/** Laravel's paginator `path()` — the current request URL, without the query string. */
function buildRequestPath(req: Request): string {
  const pathOnly = req.originalUrl.split('?')[0];
  return `${req.protocol}://${req.get('host')}${pathOnly}`;
}

export function createListContactQuestHandler(service: ContactQuestService) {
  return asyncHandler(async (req: Request, res: Response) => {
    // Coerced to a number by validateRequest's query schema (contact-quest.schemas.ts).
    const page = req.query.page as unknown as number;
    const envelope = await service.listPage({ page, path: buildRequestPath(req) });
    res.status(200).json(envelope);
  });
}
