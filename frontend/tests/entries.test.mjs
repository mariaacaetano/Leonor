import assert from 'node:assert/strict';
import {test} from 'node:test';
import {filterAndSortEntries, emptyEntryFilters} from '../src/entries.ts';

const entry = (transaction_id, overrides = {}) => ({
  id: transaction_id, transaction_id, description: 'Compra', amount: 1000, total_amount: 1000,
  payer_tag_id: null, payer_tag: null, kind: 'expense', payment: 'pix', category: 'Outros',
  source: null, creditor: null, card_id: null, purchased_on: '2026-09-28', due_date: '2026-10-08', installment: 1,
  installments: 1, paid: false, reimbursement_person: null, reimbursement_received: false,
  ...overrides,
});
const select = (entries, filters = {}, sort = 'newest') => filterAndSortEntries(entries, {...emptyEntryFilters, ...filters}, sort);
const ids = entries => entries.map(e => e.transaction_id);

test('registration order ignores purchase dates and installment IDs, without mutating input', () => {
  const entries = [entry(3, {due_date: '2026-10-01'}), entry(1, {id: 99}), entry(2, {due_date: '2026-10-31'})];
  assert.deepEqual(ids(select(entries)), [3, 2, 1]);
  assert.deepEqual(ids(select(entries, {}, 'oldest')), [1, 2, 3]);
  assert.deepEqual(ids(entries), [3, 1, 2]);
});

test('installments from the same purchase stay in installment order', () => {
  const entries = [entry(2, {id: 80, installment: 2}), entry(1), entry(2, {id: 90, installment: 1})];
  assert.deepEqual(select(entries).map(e => e.id), [90, 80, 1]);
});

test('sort by due date, displayed total (not installment amount), and Portuguese description', () => {
  const entries = [
    entry(1, {description: 'Zebra', due_date: '2026-10-10', total_amount: 5000, amount: 500}),
    entry(2, {description: 'Água', due_date: '2026-10-05', total_amount: 2000, amount: 2000}),
    entry(3, {description: 'Mercado', due_date: '2026-10-20', total_amount: 3000, amount: 1000}),
  ];
  for (const [sort, expected] of Object.entries({
    due_asc: [2, 1, 3], due_desc: [3, 1, 2], amount_asc: [2, 3, 1], amount_desc: [1, 3, 2],
    description_asc: [2, 3, 1], description_desc: [1, 3, 2],
  })) assert.deepEqual(ids(select(entries, {}, sort)), expected, sort);
  assert.deepEqual(ids(select([entry(1), entry(3), entry(2)], {}, 'due_asc')), [3, 2, 1]);
});

test('search matches accents, case, whitespace, source, creditor, category and payer', () => {
  const entries = [entry(1, {description: 'Compra na Farmácia', category: 'Saúde', payer_tag: 'Mãe'}),
    entry(2, {source: 'Fábrica/USP'}), entry(3, {creditor: 'João'})];
  for (const search of [' FARMACIA ', 'saude', 'MAE']) assert.deepEqual(ids(select(entries, {search})), [1]);
  assert.deepEqual(ids(select(entries, {search: 'fabrica'})), [2]);
  assert.deepEqual(ids(select(entries, {search: 'joao'})), [3]);
  assert.deepEqual(ids(select(entries, {search: '   '})), [3, 2, 1]);
});

test('filters combine and distinguish pending, paid, income, cards and payer tags', () => {
  const entries = [
    entry(1, {payment: 'credit', category: 'Saúde', card_id: 7, payer_tag_id: 4, payer_tag: 'Ana'}),
    entry(2, {payment: 'credit', category: 'Saúde', card_id: 7, payer_tag_id: 4, payer_tag: 'Ana', paid: true}),
    entry(3, {kind: 'income', payment: 'received', paid: true}), entry(4, {card_id: 8}),
  ];
  const filters = {kind: 'expense', status: 'pending', category: 'Saúde', payment: 'credit', card: '7', payer: '4', search: 'ana'};
  assert.deepEqual(ids(select(entries, filters)), [1]);
  for (const [key, value] of Object.entries({kind: 'income', status: 'paid', category: 'Outros', payment: 'pix', card: '8', payer: 'self', search: 'inexistente'})) {
    assert.ok(!ids(select(entries, {...filters, [key]: value})).includes(1), key);
  }
  assert.deepEqual(ids(select(entries, {status: 'paid'})), [3, 2]);
  assert.deepEqual(ids(select(entries, {payer: 'self'})), [4, 3]);
  assert.deepEqual(select(entries, {search: 'inexistente'}), []);
  assert.deepEqual(ids(select(entries)), [4, 3, 2, 1]);
});
