import { describe, expect, it } from 'vitest';
import { buildLaravelPagination } from '../../src/shared/http/laravel-pagination';

const PATH = 'https://api.example.com/api/v2/contact-quest';

describe('buildLaravelPagination', () => {
  it('builds first/last page URLs and null prev/next on a single-page result', () => {
    const envelope = buildLaravelPagination({
      data: [{ id: 1 }],
      total: 1,
      currentPage: 1,
      perPage: 10,
      path: PATH,
    });

    expect(envelope.last_page).toBe(1);
    expect(envelope.first_page_url).toBe(`${PATH}?page=1`);
    expect(envelope.last_page_url).toBe(`${PATH}?page=1`);
    expect(envelope.next_page_url).toBeNull();
    expect(envelope.prev_page_url).toBeNull();
    expect(envelope.from).toBe(1);
    expect(envelope.to).toBe(1);
  });

  it('computes from/to/last_page/next/prev correctly on a middle page of a multi-page result', () => {
    const envelope = buildLaravelPagination({
      data: [{ id: 11 }],
      total: 25,
      currentPage: 2,
      perPage: 10,
      path: PATH,
    });

    expect(envelope.last_page).toBe(3);
    expect(envelope.from).toBe(11);
    expect(envelope.to).toBe(20);
    expect(envelope.next_page_url).toBe(`${PATH}?page=3`);
    expect(envelope.prev_page_url).toBe(`${PATH}?page=1`);
  });

  it('caps `to` at total on the last (partial) page', () => {
    const envelope = buildLaravelPagination({
      data: [{ id: 21 }],
      total: 25,
      currentPage: 3,
      perPage: 10,
      path: PATH,
    });

    expect(envelope.to).toBe(25);
    expect(envelope.next_page_url).toBeNull();
  });

  it('returns from/to: null and last_page: 1 when total is 0', () => {
    const envelope = buildLaravelPagination({
      data: [],
      total: 0,
      currentPage: 1,
      perPage: 10,
      path: PATH,
    });

    expect(envelope.from).toBeNull();
    expect(envelope.to).toBeNull();
    expect(envelope.last_page).toBe(1);
    expect(envelope.data).toEqual([]);
  });

  it('marks only the current page as active in `links`, with Previous/Next entries at both ends', () => {
    const envelope = buildLaravelPagination({
      data: [{ id: 11 }],
      total: 25,
      currentPage: 2,
      perPage: 10,
      path: PATH,
    });

    expect(envelope.links[0]).toMatchObject({ label: '&laquo; Previous', active: false });
    expect(envelope.links.at(-1)).toMatchObject({ label: 'Next &raquo;', active: false });
    const activeLinks = envelope.links.filter((link) => link.active);
    expect(activeLinks).toHaveLength(1);
    expect(activeLinks[0]).toMatchObject({ label: '2' });
  });
});
