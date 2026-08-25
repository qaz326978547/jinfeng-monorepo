//參數類型
export interface AddContactInfo {
    class: string;
    quest: string;
    company: string;
    tel: string;
    num: string;
    last5: string;
    ticket: string;
    ticket_name: string;
    ticket_no: string;
    ticket_address: string;
    from: string;
    suggest_name: string;
    contactList: ContactListInfo[];
}
//新增報名課程  參加人員資料
export interface ContactListInfo {
    name: string;
    cel: string;
    job: string;
    email: string;
}

//faq

export interface FAQData {
    id: number;
    name: string;
    info: string;
    no: number;
}

export interface ContactClassData extends FAQData {}

//回傳類型

interface Contact {
    id: number;
    class: string;
    quest: string;
    company: string;
    tel: string;
    num: string;
    last5: string;
    ticket: string;
    ticket_name: string;
    ticket_no: string;
    ticket_address: string;
    from: string;
    suggest_name: string;
    del: number;
    no: number;
    created_at: string;
    updated_at: string;
}

export interface ContactData {
    current_page: number;
    data: Contact[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    next_page_url: string;
    path: string;
    per_page: number;
    prev_page_url: string;
    to: number;
    total: number;
}

interface ContactList {
    id: number;
    name: string;
    cel: string;
    job: string;
    email: string;
    no: number;
    cid: number;
    created_at: string;
    updated_at: string;
}

export interface ContactListData extends Contact {
    contact_list: ContactList[];
}

export interface ContactClass {
    id: number;
    name: string;
    no: number;
    del: number;
    created_at: string;
    updated_at: string;
}

export interface ContactClassData {
    current_page: number;
    data: ContactClass[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}

//單筆 報名資訊

