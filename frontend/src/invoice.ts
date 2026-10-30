import type {Entry} from './entries';

export type Card = {id:number,name:string,closing_day:number,due_day:number};
export type CardPayment = {id:number,card_id:number,payer_tag_id:number|null,payer_tag:string|null,amount:number,paid_on:string,invoice_month:string,description:string};
export type InvoiceFilters = {search:string,category:string,person:string,kind:string,status:string,reimbursement:string};
export const emptyInvoiceFilters:InvoiceFilters = {search:'',category:'',person:'',kind:'',status:'',reimbursement:''};
export const invoiceSortOptions = {
  newest:'Cadastro: mais recentes', oldest:'Cadastro: mais antigos',
  purchase_desc:'Compra: mais recente', purchase_asc:'Compra: mais antiga',
  due_asc:'Vencimento: mais próximo', due_desc:'Vencimento: mais distante',
  amount_desc:'Parcela: maior valor', amount_asc:'Parcela: menor valor',
  description_asc:'Descrição: A a Z', description_desc:'Descrição: Z a A',
};
export type InvoiceSort = keyof typeof invoiceSortOptions;
export type GroupSort = 'amount_desc'|'amount_asc'|'name_asc'|'name_desc';
export const signedAmount = (entry:Entry) => entry.kind==='expense'?entry.amount:-entry.amount;
export const hasReimbursement = (entry:Entry) => entry.kind==='expense'&&!!entry.reimbursement_person;
export const personKey = (entry:Entry) => hasReimbursement(entry)?(entry.payer_tag_id!==null?'tag:'+entry.payer_tag_id:'name:'+entry.reimbursement_person):'self';
const normalize = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

export function invoiceSummary(allEntries:Entry[],allPayments:CardPayment[],cardId:number) {
  const entries=allEntries.filter(e=>e.card_id===cardId&&e.payment==='credit');
  const payments=allPayments.filter(p=>p.card_id===cardId);
  const total=entries.reduce((sum,e)=>sum+signedAmount(e),0);
  const paid=payments.reduce((sum,p)=>sum+p.amount,0);
  const marked=entries.filter(e=>e.kind==='expense'&&e.paid).reduce((sum,e)=>sum+e.amount,0);
  const receivable=entries.filter(e=>hasReimbursement(e)&&!e.reimbursement_received).reduce((sum,e)=>sum+e.amount,0);
  const received=entries.filter(e=>hasReimbursement(e)&&e.reimbursement_received).reduce((sum,e)=>sum+e.amount,0);
  return {entries,payments,total,paid,remaining:Math.max(0,total-Math.max(paid,marked)),receivable,received};
}

export function filterInvoiceEntries(entries:Entry[],filters:InvoiceFilters,sort:InvoiceSort) {
  const search=normalize(filters.search.trim());
  return entries.filter(e=>{
    const text=normalize([e.description,e.category,e.payer_tag,e.reimbursement_person,e.source].filter(Boolean).join(' '));
    return text.includes(search)
      && (!filters.category||e.category===filters.category)
      && (!filters.person||personKey(e)===filters.person)
      && (!filters.kind||e.kind===filters.kind)
      && (!filters.status||e.paid===(filters.status==='paid'))
      && (!filters.reimbursement||(filters.reimbursement==='none'?!hasReimbursement(e):hasReimbursement(e)&&e.reimbursement_received===(filters.reimbursement==='received')));
  }).sort((a,b)=>{
    let comparison=0;
    switch(sort){
      case 'newest':comparison=b.transaction_id-a.transaction_id;break;
      case 'oldest':comparison=a.transaction_id-b.transaction_id;break;
      case 'purchase_desc':comparison=b.purchased_on.localeCompare(a.purchased_on);break;
      case 'purchase_asc':comparison=a.purchased_on.localeCompare(b.purchased_on);break;
      case 'due_asc':comparison=a.due_date.localeCompare(b.due_date);break;
      case 'due_desc':comparison=b.due_date.localeCompare(a.due_date);break;
      case 'amount_desc':comparison=b.amount-a.amount;break;
      case 'amount_asc':comparison=a.amount-b.amount;break;
      case 'description_asc':comparison=a.description.localeCompare(b.description,'pt-BR');break;
      case 'description_desc':comparison=b.description.localeCompare(a.description,'pt-BR');break;
    }
    return comparison||b.transaction_id-a.transaction_id||a.installment-b.installment||a.id-b.id;
  });
}

export function groupInvoiceCategories(entries:Entry[]) {
  const groups=new Map<string,{key:string,name:string,entries:Entry[],total:number,expenses:number,credits:number}>();
  for(const e of entries){
    const group=groups.get(e.category)||{key:e.category,name:e.category,entries:[],total:0,expenses:0,credits:0};
    group.entries.push(e);group.total+=signedAmount(e);
    if(e.kind==='expense')group.expenses+=e.amount;else group.credits+=e.amount;
    groups.set(e.category,group);
  }
  return [...groups.values()];
}
export function groupInvoicePeople(entries:Entry[]) {
  const groups=new Map<string,{key:string,name:string,entries:Entry[],total:number,received:number}>();
  for(const e of entries){
    if(!hasReimbursement(e))continue;
    const key=personKey(e);
    const group=groups.get(key)||{key,name:e.reimbursement_person!,entries:[],total:0,received:0};
    group.entries.push(e);
    if(e.reimbursement_received)group.received+=e.amount;else group.total+=e.amount;
    groups.set(key,group);
  }
  return [...groups.values()];
}
export function sortInvoiceGroups<T extends {name:string,total:number}>(groups:T[],sort:GroupSort):T[] {
  return [...groups].sort((a,b)=>{
    const byName=a.name.localeCompare(b.name,'pt-BR');
    if(sort==='name_asc')return byName;
    if(sort==='name_desc')return -byName;
    return (sort==='amount_asc'?a.total-b.total:b.total-a.total)||byName;
  });
}
