export type Entry={id:number,transaction_id:number,description:string,amount:number,total_amount:number,payer_tag_id:number|null,payer_tag:string|null,kind:string,payment:string,category:string,source:string|null,creditor:string|null,card_id:number|null,purchased_on:string,due_date:string,installment:number,installments:number,paid:boolean,reimbursement_person:string|null,reimbursement_received:boolean};

export type EntryFilters = {
  search: string;
  kind: string;
  status: string;
  category: string;
  payment: string;
  card: string;
  payer: string;
};
export const emptyEntryFilters: EntryFilters = {
  search: '', kind: '', status: '', category: '', payment: '', card: '', payer: '',
};
export const entrySortOptions = {
  newest: 'Cadastrados mais recentemente',
  oldest: 'Cadastrados há mais tempo',
  due_asc: 'Vencimento: mais próximo',
  due_desc: 'Vencimento: mais distante',
  amount_desc: 'Valor total: maior primeiro',
  amount_asc: 'Valor total: menor primeiro',
  description_asc: 'Descrição: A a Z',
  description_desc: 'Descrição: Z a A',
};
export type EntrySort = keyof typeof entrySortOptions;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export function filterAndSortEntries(entries: Entry[], filters: EntryFilters, sort: EntrySort): Entry[] {
  const search = normalize(filters.search.trim());
  const filtered = entries.filter(entry => {
    const text = [entry.description, entry.category, entry.source, entry.creditor, entry.payer_tag].filter(Boolean).join(' ');
    return normalize(text).includes(search)
      && (!filters.kind || entry.kind === filters.kind)
      && (!filters.status || entry.paid === (filters.status === 'paid'))
      && (!filters.category || entry.category === filters.category)
      && (!filters.payment || entry.payment === filters.payment)
      && (!filters.card || String(entry.card_id) === filters.card)
      && (!filters.payer || (filters.payer === 'self' ? entry.payer_tag_id === null : String(entry.payer_tag_id) === filters.payer));
  });
  // Transaction IDs follow registration order; edits and new installments keep the purchase's position.
  const recentFirst = (a: Entry, b: Entry) => b.transaction_id - a.transaction_id;
  return filtered.sort((a, b) => {
    let result = 0;
    switch (sort) {
      case 'newest': result = recentFirst(a, b); break;
      case 'oldest': result = -recentFirst(a, b); break;
      case 'due_asc': result = a.due_date.localeCompare(b.due_date); break;
      case 'due_desc': result = b.due_date.localeCompare(a.due_date); break;
      case 'amount_desc': result = b.total_amount - a.total_amount; break;
      case 'amount_asc': result = a.total_amount - b.total_amount; break;
      case 'description_asc': result = a.description.localeCompare(b.description, 'pt-BR'); break;
      case 'description_desc': result = b.description.localeCompare(a.description, 'pt-BR'); break;
    }
    return result || recentFirst(a, b) || a.installment - b.installment || a.id - b.id;
  });
}
