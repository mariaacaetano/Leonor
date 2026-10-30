export type Company = {id:number, name:string};
export type CompanyItem = {description:string, quantity:string, amount:number, unit_cost:string};
export type CompanyRecord = {
  id:number, kind:'expense'|'income', description:string, location:string,
  occurred_on:string, amount:number, installments:number, items:CompanyItem[],
  schedule:{number:number, due_date:string, amount:number}[]
};
export type CompanyLedger = {
  company:Company, month:string, records:CompanyRecord[],
  monthly:{income:number, expenses:number, balance:number},
  total:{income:number, expenses:number, balance:number}
};
export type DraftItem = {description:string, quantity:string, amount:string};
export const companyMoney = (cents:number) => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(cents / 100);
export const unitMoney = (value:number) => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:6}).format(value);
export function amountCents(value:string):number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 0;
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export const itemTotal = (items:DraftItem[]) => items.reduce((sum, item) => sum + amountCents(item.amount), 0);
export const itemUnitCost = (item:DraftItem) => Number(item.quantity) > 0 ? amountCents(item.amount) / 100 / Number(item.quantity) : 0;
export const recordMonthAmount = (record:CompanyRecord, month:string) => record.schedule.reduce((sum, entry) => sum + (entry.due_date.slice(0,7) === month ? entry.amount : 0), 0);
export function filterCompanyRecords(records:CompanyRecord[], month:string, scope:string, search:string) {
  const query = search.trim().toLocaleLowerCase('pt-BR');
  return records.filter(record => (scope === 'all' || record.schedule.some(entry => entry.due_date.slice(0,7) === month)) &&
    (!query || [record.description, record.location, ...record.items.map(item => item.description)].some(text => text.toLocaleLowerCase('pt-BR').includes(query))));
}
