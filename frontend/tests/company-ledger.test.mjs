import assert from 'node:assert/strict';
import {test} from 'node:test';
import {amountCents, itemTotal, itemUnitCost, filterCompanyRecords, recordMonthAmount} from '../src/company-ledger.ts';

test('note totals sum cents exactly and unit cost divides the item total by quantity', () => {
  const items = [{description:'Peças', quantity:'3', amount:'100.00'}, {description:'Embalagens', quantity:'2.5', amount:'0.29'}];
  assert.equal(amountCents('0.29'), 29);
  assert.equal(itemTotal(items), 10029);
  assert.equal(itemTotal([{amount:'0.10'}, {amount:'0.20'}]), 30);
  assert.equal(itemUnitCost(items[0]), 100 / 3);
  assert.equal(itemUnitCost(items[1]), 0.29 / 2.5);
  assert.equal(itemUnitCost({...items[0], quantity:'0'}), 0);
  assert.equal(amountCents('10.001'), 0);
  assert.equal(amountCents(''), 0);
});

test('month view finds prior purchases with installments in the selected month and searches note items', () => {
  const purchase = {id:1, description:'Materiais', location:'Fornecedor', amount:10000, items:[{description:'Camisetas'}], schedule:[{due_date:'2026-01-31', amount:3334}, {due_date:'2026-02-28', amount:3333}]};
  const sale = {id:2, description:'Venda', location:'', amount:20000, items:[], schedule:[{due_date:'2026-01-15', amount:20000}]};
  const records = [purchase, sale];
  assert.deepEqual(filterCompanyRecords(records, '2026-02', 'month', '').map(r => r.id), [1]);
  assert.equal(recordMonthAmount(purchase, '2026-02'), 3333);
  assert.equal(recordMonthAmount(purchase, '2026-03'), 0);
  assert.deepEqual(filterCompanyRecords(records, '2026-02', 'all', '').map(r => r.id), [1,2]);
  assert.deepEqual(filterCompanyRecords(records, '2026-01', 'month', ' CAMISETAS '), [purchase]);
  assert.deepEqual(filterCompanyRecords(records, '2026-01', 'month', 'fornecedor'), [purchase]);
  assert.deepEqual(filterCompanyRecords(records, '2026-01', 'month', 'venda'), [sale]);
});
