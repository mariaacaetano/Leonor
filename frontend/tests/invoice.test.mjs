import assert from 'node:assert/strict';
import {test} from 'node:test';
import {emptyInvoiceFilters,filterInvoiceEntries,groupInvoiceCategories,groupInvoicePeople,invoiceSummary,sortInvoiceGroups} from '../src/invoice.ts';
const entry=(id,overrides={})=>({id,transaction_id:id,description:'Compra',amount:1000,total_amount:6000,payer_tag_id:null,payer_tag:null,kind:'expense',payment:'credit',category:'Mercado',source:null,creditor:null,card_id:1,purchased_on:'2026-09-20',due_date:'2026-10-08',installment:1,installments:6,paid:false,reimbursement_person:null,reimbursement_received:false,...overrides});
const payment=(id,amount,card_id=1)=>({id,card_id,payer_tag_id:null,payer_tag:null,amount,paid_on:'2026-10-08',invoice_month:'2026-10',description:'Pagamento'});
const select=(entries,filters={},sort='newest')=>filterInvoiceEntries(entries,{...emptyInvoiceFilters,...filters},sort);
const ids=entries=>entries.map(e=>e.id);

test('invoice totals isolate credit entries and payments by card, and do not subtract payments twice',()=>{
  const entries=[entry(1,{amount:3000,paid:true}),entry(2,{amount:4000}),entry(3,{amount:500,kind:'income'}),entry(4,{amount:90000,card_id:2}),entry(5,{amount:10000,payment:'debit'})];
  const result=invoiceSummary(entries,[payment(1,2000),payment(2,100000,2)],1);
  assert.deepEqual(ids(result.entries),[1,2,3]);
  assert.equal(result.total,6500);
  assert.equal(result.paid,2000);
  assert.equal(result.remaining,3500); // Uses max(marked paid, recorded payments).
  assert.equal(invoiceSummary(entries,[payment(3,10000)],1).remaining,0);
  assert.equal(invoiceSummary([],[],1).remaining,0);
});

test('debts count only pending expense reimbursements; paying the card does not settle a person’s debt',()=>{
  const entries=[entry(1,{payer_tag_id:1,reimbursement_person:'Mãe',amount:1200,paid:true}),entry(2,{payer_tag_id:1,reimbursement_person:'Mãe',amount:800,reimbursement_received:true}),entry(3,{kind:'income',amount:500,reimbursement_person:'Mãe'}),entry(4,{amount:6000})];
  const summary=invoiceSummary(entries,[payment(1,1200)],1);
  assert.equal(summary.receivable,1200);
  assert.equal(summary.received,800);
  const people=groupInvoicePeople(entries);
  assert.equal(people.length,1);
  assert.equal(people[0].total,1200);
  assert.equal(people[0].received,800);
  assert.deepEqual(ids(people[0].entries),[1,2]);
  const settled=entries.map(e=>e.id===1?{...e,reimbursement_received:true}:e);
  assert.equal(invoiceSummary(settled,[],1).receivable,0);
  assert.equal(groupInvoicePeople(settled)[0].received,2000);
});

test('category totals use each installment and subtract credits, including negative categories',()=>{
  const groups=groupInvoiceCategories([entry(1,{amount:3334,total_amount:10000}),entry(2,{amount:500,kind:'income'}),entry(3,{amount:1200,kind:'income',category:'Outros'})]);
  assert.deepEqual(groups.map(g=>[g.name,g.total,g.expenses,g.credits]),[['Mercado',2834,3334,500],['Outros',-1200,0,1200]]);
  assert.equal(groups[0].entries.length,2);
});

test('invoice filters combine category, person, payment status, reimbursement, type and accent-insensitive search',()=>{
  const entries=[entry(1,{description:'Farmácia',category:'Saúde',payer_tag_id:2,payer_tag:'Mãe',reimbursement_person:'Mãe',paid:true}),entry(2,{description:'Farmácia',category:'Saúde',payer_tag_id:2,payer_tag:'Mãe',reimbursement_person:'Mãe',paid:true,reimbursement_received:true}),entry(3,{kind:'income'}),entry(4)];
  const filters={search:' FARMACIA ',category:'Saúde',person:'tag:2',status:'paid',reimbursement:'pending',kind:'expense'};
  assert.deepEqual(ids(select(entries,filters)),[1]);
  assert.deepEqual(ids(select(entries,{...filters,reimbursement:'received'})),[2]);
  assert.deepEqual(ids(select(entries,{person:'self',reimbursement:'none'})),[4,3]);
  assert.deepEqual(ids(select(entries,{search:'mae'})),[2,1]);
  assert.deepEqual(select(entries,{...filters,kind:'income'}),[]);
  assert.deepEqual(select(entries,{search:'inexistente'}),[]);
});

test('people groups retain legacy names and distinguish tag IDs even when names match',()=>{
  const groups=groupInvoicePeople([entry(1,{reimbursement_person:'Ana',payer_tag_id:1}),entry(2,{reimbursement_person:'Ana',payer_tag_id:2}),entry(3,{reimbursement_person:'Antigo'}),entry(4)]);
  assert.deepEqual(groups.map(g=>g.key),['tag:1','tag:2','name:Antigo']);
  assert.deepEqual(ids(select(groups[2].entries,{person:'name:Antigo'})),[3]);
});

test('sort by installment value rather than total purchase, and support dates and descriptions',()=>{
  const entries=[entry(1,{description:'Zebra',amount:500,total_amount:50000,purchased_on:'2026-09-30',due_date:'2026-10-15'}),entry(2,{description:'Água',amount:2000,total_amount:2000,purchased_on:'2026-09-01',due_date:'2026-10-08'}),entry(3,{description:'Mercado',amount:1000,purchased_on:'2026-09-20',due_date:'2026-10-10'})];
  for(const [sort,expected] of Object.entries({newest:[3,2,1],oldest:[1,2,3],amount_desc:[2,3,1],amount_asc:[1,3,2],purchase_desc:[1,3,2],purchase_asc:[2,3,1],due_asc:[2,3,1],due_desc:[1,3,2],description_asc:[2,3,1],description_desc:[1,3,2]}))assert.deepEqual(ids(select(entries,{},sort)),expected,sort);
  assert.deepEqual(ids(entries),[1,2,3]);
  assert.deepEqual(ids(select([entry(2,{id:9,installment:2}),entry(2,{id:8,installment:1})])),[8,9]);
});

test('category and person groups can be ordered by amount or Portuguese name without mutation',()=>{
  const groups=[{name:'Zebra',total:100},{name:'Água',total:300},{name:'Mercado',total:200}];
  assert.deepEqual(sortInvoiceGroups(groups,'amount_desc').map(g=>g.name),['Água','Mercado','Zebra']);
  assert.deepEqual(sortInvoiceGroups(groups,'amount_asc').map(g=>g.name),['Zebra','Mercado','Água']);
  assert.deepEqual(sortInvoiceGroups(groups,'name_asc').map(g=>g.name),['Água','Mercado','Zebra']);
  assert.deepEqual(sortInvoiceGroups(groups,'name_desc').map(g=>g.name),['Zebra','Mercado','Água']);
  assert.equal(groups[0].name,'Zebra');
});
