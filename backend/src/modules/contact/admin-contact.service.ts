import {
  buildLaravelPagination,
  type LaravelPaginatedEnvelope,
} from '../../shared/http/laravel-pagination';
import type { ContactListRow } from '../contact-list/contact-list.repository';
import type { ContactRepository, ContactRow } from './contact.repository';

const PER_PAGE = 10;

/** GET /admin/contact/{id} response shape — contact fields + the nested `contact_list` relation. */
export interface AdminContactWithList extends ContactRow {
  contact_list: ContactListRow[];
}

export class AdminContactService {
  constructor(private readonly repository: ContactRepository) {}

  async listPage(params: { page: number; path: string }): Promise<LaravelPaginatedEnvelope<ContactRow>> {
    const total = await this.repository.countAll();
    const offset = (params.page - 1) * PER_PAGE;
    const data = total === 0 ? [] : await this.repository.findPage(PER_PAGE, offset);

    return buildLaravelPagination({
      data,
      total,
      currentPage: params.page,
      perPage: PER_PAGE,
      path: params.path,
    });
  }

  async getById(id: number): Promise<AdminContactWithList | null> {
    const contact = await this.repository.findById(id);
    if (!contact) {
      return null;
    }
    const contactList = await this.repository.findContactListByContactId(id);
    return { ...contact, contact_list: contactList };
  }

  async searchByCompany(params: {
    company: string;
    page: number;
    path: string;
  }): Promise<LaravelPaginatedEnvelope<ContactRow>> {
    const total = await this.repository.countByCompany(params.company);
    const offset = (params.page - 1) * PER_PAGE;
    const data =
      total === 0 ? [] : await this.repository.findByCompanyPage(params.company, PER_PAGE, offset);

    return buildLaravelPagination({
      data,
      total,
      currentPage: params.page,
      perPage: PER_PAGE,
      path: params.path,
    });
  }
}
