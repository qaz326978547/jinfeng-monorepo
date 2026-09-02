import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/async-handler';
import { buildRequestPath } from '../../shared/http/request-path';
import type { LaborNewsService } from './labor-news.service';

export function createListLaborNewsHandler(service: LaborNewsService) {
  return asyncHandler(async (req: Request, res: Response) => {
    // Coerced/defaulted by validateRequest's query schema (labor-news.schemas.ts).
    const page = req.query.page as unknown as number;
    const pageSize = req.query.pageSize as unknown as number;
    const keyword = req.query.keyword as unknown as string;
    const envelope = await service.listActive({ page, pageSize, keyword, path: buildRequestPath(req) });
    res.status(200).json(envelope);
  });
}
