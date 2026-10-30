from decimal import Decimal

import pytest
from test_finance import account, client, transaction


def company(client, headers, name='Minha empresa'):
    response = client.post('/api/companies', headers=headers, json={'name':name})
    assert response.status_code == 201
    return response.json()['id']


def expense(**changes):
    return {'kind':'expense', 'description':'Materiais', 'location':'Fornecedor',
            'occurred_on':'2026-01-31', 'amount':'100.00', 'installments':3, **changes}


def ledger(client, headers, ident, month='2026-01'):
    response = client.get(f'/api/companies/{ident}/ledger?month={month}', headers=headers)
    assert response.status_code == 200
    return response.json()


def test_company_notes_items_and_exact_installments(client):
    headers = account(client, 'owner@example.com')
    ident = company(client, headers, ' Minha loja ')
    assert client.get('/api/companies', headers=headers).json() == [{'id':ident, 'name':'Minha loja'}]
    body = expense(items=[{'description':' Peças ', 'quantity':'3', 'amount':'70.00'},
                          {'description':'Embalagens', 'quantity':'2.5', 'amount':'30.00'}])
    assert client.post(f'/api/companies/{ident}/records', headers=headers, json=body).status_code == 201
    data = ledger(client, headers, ident)
    record = data['records'][0]
    assert record['items'][0]['description'] == 'Peças'
    assert Decimal(record['items'][0]['unit_cost']) == Decimal('23.333333')
    assert Decimal(record['items'][1]['unit_cost']) == Decimal('12')
    assert [row['amount'] for row in record['schedule']] == [3334, 3333, 3333]
    assert [row['due_date'] for row in record['schedule']] == ['2026-01-31', '2026-02-28', '2026-03-31']
    assert data['monthly'] == {'income':0, 'expenses':3334, 'balance':-3334}
    assert data['total'] == {'income':0, 'expenses':10000, 'balance':-10000}
    assert ledger(client, headers, ident, '2026-02')['monthly']['expenses'] == 3333
    assert ledger(client, headers, ident, '2026-04')['monthly']['expenses'] == 0
    assert client.get('/api/dashboard?month=2026-01', headers=headers).json()['expenses'] == 0


def test_company_sales_edits_and_deletion_recalculate_balances(client):
    headers = account(client, 'owner@example.com')
    ident = company(client, headers)
    url = f'/api/companies/{ident}/records'
    note = client.post(url, headers=headers, json=expense()).json()['id']
    sale_body = {'kind':'income', 'description':'Vendas da semana', 'occurred_on':'2026-01-15', 'amount':'200.00'}
    sale = client.post(url, headers=headers, json=sale_body).json()['id']
    assert ledger(client, headers, ident)['monthly'] == {'income':20000, 'expenses':3334, 'balance':16666}
    assert ledger(client, headers, ident)['total']['balance'] == 10000
    edited_note = expense(amount='120.01', installments=2, occurred_on='2026-02-28',
                          items=[{'description':'Peças novas', 'quantity':'4', 'amount':'120.01'}])
    assert client.put(f'{url}/{note}', headers=headers, json=edited_note).status_code == 200
    assert ledger(client, headers, ident)['monthly']['expenses'] == 0
    feb = ledger(client, headers, ident, '2026-02')
    assert feb['monthly']['expenses'] == 6001
    assert feb['records'][0]['items'][0]['unit_cost'] == '30.002500'
    assert client.put(f'{url}/{sale}', headers=headers, json={**sale_body, 'amount':'250.50'}).status_code == 200
    assert ledger(client, headers, ident)['total'] == {'income':25050, 'expenses':12001, 'balance':13049}
    # Replacing an itemized note with a simple expense removes its items.
    assert client.put(f'{url}/{note}', headers=headers, json=expense(amount='15.00', installments=1)).status_code == 200
    assert next(r for r in ledger(client, headers, ident)['records'] if r['id'] == note)['items'] == []
    assert client.delete(f'{url}/{sale}', headers=headers).status_code == 204
    assert ledger(client, headers, ident)['total'] == {'income':0, 'expenses':1500, 'balance':-1500}
    assert client.delete(f'{url}/{note}', headers=headers).status_code == 204
    assert ledger(client, headers, ident)['records'] == []
    assert ledger(client, headers, ident)['total']['balance'] == 0


def test_company_and_record_isolation(client):
    owner = account(client, 'owner@example.com')
    other = account(client, 'other@example.com')
    first = company(client, owner)
    second = company(client, owner, 'Outra empresa')
    foreign = company(client, other)
    body = expense(items=[{'description':'Privado', 'quantity':'1', 'amount':'100.00'}])
    url = f'/api/companies/{first}/records'
    note = client.post(url, headers=owner, json=body).json()['id']
    assert len(client.get('/api/companies', headers=other).json()) == 1
    for method, path, payload in [
        ('GET', f'/api/companies/{first}/ledger?month=2026-01', None),
        ('PATCH', f'/api/companies/{first}', {'name':'Invadida'}),
        ('DELETE', f'/api/companies/{first}', None),
        ('POST', url, body), ('PUT', f'{url}/{note}', body), ('DELETE', f'{url}/{note}', None),
        ('PUT', f'/api/companies/{foreign}/records/{note}', body),
        ('DELETE', f'/api/companies/{foreign}/records/{note}', None),
    ]:
        assert client.request(method, path, headers=other, json=payload).status_code == 404
    # An owned note cannot be accessed under another owned company either.
    assert client.put(f'/api/companies/{second}/records/{note}', headers=owner, json=body).status_code == 404
    assert client.delete(f'/api/companies/{second}/records/{note}', headers=owner).status_code == 404
    assert ledger(client, owner, second)['records'] == []
    assert ledger(client, other, foreign)['records'] == []
    assert len(ledger(client, owner, first)['records'][0]['items']) == 1
    assert client.get('/api/companies').status_code == 401
    assert client.post('/api/companies', json={'name':'Sem conta'}).status_code == 401
    assert client.post(url, json=body).status_code == 401


@pytest.mark.parametrize('changes', [
    {'description':' '}, {'amount':'0'}, {'amount':'10.001'}, {'installments':0}, {'installments':121},
    {'amount':'0.01', 'installments':2}, {'occurred_on':'2026-02-30'},
    {'occurred_on':'9999-12-31', 'installments':2},
    {'items':[{'description':' ', 'quantity':'1', 'amount':'100.00'}]},
    {'items':[{'description':'Peça', 'quantity':'0', 'amount':'100.00'}]},
    {'items':[{'description':'Peça', 'quantity':'-1', 'amount':'100.00'}]},
    {'items':[{'description':'Peça', 'quantity':'1.0001', 'amount':'100.00'}]},
    {'items':[{'description':'Peça', 'quantity':'1', 'amount':'99.99'}]},
    {'kind':'income'},
    {'kind':'income', 'installments':1, 'items':[{'description':'Peça', 'quantity':'1', 'amount':'100.00'}]},
])
def test_company_validation_preserves_existing_records(client, changes):
    headers = account(client, 'owner@example.com')
    ident = company(client, headers)
    url = f'/api/companies/{ident}/records'
    record = client.post(url, headers=headers, json=expense()).json()['id']
    before = ledger(client, headers, ident)
    assert client.post(url, headers=headers, json=expense(**changes)).status_code == 422
    assert client.put(f'{url}/{record}', headers=headers, json=expense(**changes)).status_code == 422
    assert ledger(client, headers, ident) == before


def test_company_rename_and_safe_delete(client):
    headers = account(client, 'owner@example.com')
    assert client.post('/api/companies', headers=headers, json={'name':' '}).status_code == 422
    ident = company(client, headers)
    assert client.patch(f'/api/companies/{ident}', headers=headers, json={'name':' Corrigida '}).json()['name'] == 'Corrigida'
    assert client.patch(f'/api/companies/{ident}', headers=headers, json={'name':' '}).status_code == 422
    for month in ['2026-13', '0000-01', '2026-1', '2026-02-01']:
        assert client.get(f'/api/companies/{ident}/ledger?month={month}', headers=headers).status_code == 422
    note = client.post(f'/api/companies/{ident}/records', headers=headers, json=expense()).json()['id']
    assert client.delete(f'/api/companies/{ident}', headers=headers).status_code == 409
    assert client.delete(f'/api/companies/{ident}/records/{note}', headers=headers).status_code == 204
    assert client.delete(f'/api/companies/{ident}', headers=headers).status_code == 204
    assert client.get('/api/companies', headers=headers).json() == []


def test_overview_company_summaries_match_ledgers_and_isolate_users(client):
    owner = account(client, 'owner@example.com')
    other = account(client, 'other@example.com')
    first = company(client, owner, 'Loja A')
    second = company(client, owner, 'Loja B')
    empty = company(client, owner, 'Sem movimentos')
    foreign = company(client, other, 'Privada')
    assert transaction(client, owner, amount='60.00', installments=1, purchased_on='2026-02-10').status_code == 201
    for ident, body in [
        (first, expense()),
        (first, {'kind':'income', 'description':'Vendas', 'occurred_on':'2026-02-15', 'amount':'200.00'}),
        (second, expense(amount='30.01', installments=2)),
        (foreign, expense(amount='999.99')),
    ]:
        assert client.post(f'/api/companies/{ident}/records', headers=other if ident == foreign else owner, json=body).status_code == 201
    for month in ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04']:
        response = client.get('/api/dashboard?month='+month, headers=owner)
        assert response.status_code == 200
        data = response.json()
        assert [summary['id'] for summary in data['companies']] == [first, second, empty]
        for summary in data['companies']:
            assert {key:summary[key] for key in ['income', 'expenses', 'balance']} == ledger(client, owner, summary['id'], month)['monthly']
    feb = client.get('/api/dashboard?month=2026-02', headers=owner).json()
    assert feb['expenses'] == 6000 and feb['balance'] == -6000
    assert feb['companies'][0] == {'id':first, 'name':'Loja A', 'income':20000, 'expenses':3333, 'balance':16667}
    assert feb['companies'][1]['expenses'] == 1500
    assert feb['companies'][2]['balance'] == 0
    private = client.get('/api/dashboard?month=2026-02', headers=other).json()['companies']
    assert len(private) == 1 and private[0]['id'] == foreign


def test_overview_refreshes_after_company_record_changes(client):
    headers = account(client, 'owner@example.com')
    ident = company(client, headers)
    url = f'/api/companies/{ident}/records'
    note = client.post(url, headers=headers, json=expense()).json()['id']
    def summary():
        return client.get('/api/dashboard?month=2026-02', headers=headers).json()['companies'][0]
    assert summary()['expenses'] == 3333
    assert client.put(f'{url}/{note}', headers=headers, json=expense(amount='120.00')).status_code == 200
    assert summary()['expenses'] == 4000
    assert client.delete(f'{url}/{note}', headers=headers).status_code == 204
    assert summary()['expenses'] == 0
    assert client.delete(f'/api/companies/{ident}', headers=headers).status_code == 204
    assert client.get('/api/dashboard?month=2026-02', headers=headers).json()['companies'] == []
