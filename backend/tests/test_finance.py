import os
os.environ['SECRET_KEY']='test-secret-key-with-at-least-32-characters'
os.environ['DATABASE_URL']='sqlite://'
# Shared in-memory connection lets TestClient and setup see the same database.
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app import main
import pytest

@pytest.fixture()
def client():
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    main.Base.metadata.create_all(engine)
    main.SessionLocal.configure(bind=engine)
    with TestClient(main.app) as client: yield client
    engine.dispose()
def account(client,email):
    r=client.post('/api/register',json={'email':email,'password':'safe-password-123','full_name':'Pessoa de Teste','phone':'(11) 99999-9999'})
    assert r.status_code==201
    return {'Authorization':'Bearer '+r.json()['token']}
def transaction(client,h,**kwargs):
    category=client.get('/api/categories',headers=h).json()[0]['id']
    payload={'description':'Compra','amount':'100.00','kind':'expense','payment':'pix','category_id':category,'purchased_on':'2026-01-31','installments':3}
    payload.update(kwargs)
    return client.post('/api/transactions',headers=h,json=payload)
def test_installments_exact_cents_and_short_months(client):
    h=account(client,'a@example.com')
    assert transaction(client,h).status_code==201
    rows=[client.get('/api/dashboard?month='+month,headers=h).json()['entries'][0] for month in ['2026-01','2026-02','2026-03']]
    assert [r['amount'] for r in rows]==[3334,3333,3333]
    assert [r['due_date'] for r in rows]==['2026-01-31','2026-02-28','2026-03-31']
    assert [r['purchased_on'] for r in rows]==['2026-01-31']*3
def test_card_closing_and_credit_refund(client):
    h=account(client,'a@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Meu cartão','closing_day':25,'due_day':5}).json()['id']
    assert transaction(client,h,payment='credit',card_id=card,purchased_on='2026-01-26',installments=1).status_code==201
    assert client.get('/api/dashboard?month=2026-02',headers=h).json()['expenses']==0
    march=client.get('/api/dashboard?month=2026-03',headers=h).json()
    assert march['expenses']==10000 and march['entries'][0]['due_date']=='2026-03-05'
    assert march['entries'][0]['purchased_on']=='2026-01-26'
    assert transaction(client,h,payment='credit',card_id=card,purchased_on='2026-01-25',installments=1,kind='income',amount='15.50').status_code==201
    assert client.get('/api/dashboard?month=2026-02',headers=h).json()['income']==1550
@pytest.mark.parametrize('purchase,closing,due,expected',[('2026-12-26',25,5,'2027-02-05'),('2026-01-10',10,20,'2026-01-20'),('2026-01-11',10,20,'2026-02-20'),('2026-01-31',31,31,'2026-02-28')])
def test_billing_dates(client,purchase,closing,due,expected):
    h=account(client,'a@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':closing,'due_day':due}).json()['id']
    assert transaction(client,h,payment='credit',card_id=card,purchased_on=purchase,installments=1).status_code==201
    assert client.get('/api/dashboard?month='+expected[:7],headers=h).json()['entries'][0]['due_date']==expected

def test_user_isolation_and_delete(client):
    a=account(client,'a@example.com'); b=account(client,'b@example.com')
    tx=transaction(client,a).json()['id']
    entry=client.get('/api/dashboard?month=2026-01',headers=a).json()['entries'][0]['id']
    assert client.get('/api/dashboard?month=2026-01',headers=b).json()['entries']==[]
    assert client.delete('/api/transactions/'+str(tx),headers=b).status_code==404
    assert client.patch('/api/entries/'+str(entry),headers=b,json={'paid':True}).status_code==404
    category=client.get('/api/categories',headers=a).json()[0]['id']
    assert transaction(client,b,category_id=category).status_code==404
    card=client.post('/api/cards',headers=a,json={'name':'Privado','closing_day':10,'due_day':20}).json()['id']
    assert transaction(client,b,payment='credit',card_id=card).status_code==404
    assert client.patch('/api/entries/'+str(entry),headers=a,json={'paid':True}).status_code==200
    assert client.get('/api/dashboard?month=2026-01',headers=a).json()['pending']==0
    assert client.delete('/api/transactions/'+str(tx),headers=a).status_code==204
    assert client.get('/api/dashboard?month=2026-03',headers=a).json()['entries']==[]
def test_auth_and_validation(client):
    h=account(client,'a@example.com')
    assert client.post('/api/login',json={'email':'a@example.com','password':'wrong-password'}).status_code==401
    assert client.post('/api/login',json={'email':'a@example.com','password':'safe-password-123'}).status_code==200
    assert client.get('/api/categories').status_code==401
    assert transaction(client,h,payment='credit').status_code==422
    assert transaction(client,h,amount='0.01',installments=2).status_code==422
    assert transaction(client,h,amount='10.001').status_code==422

def test_debit_card_keeps_purchase_date_and_credit_billing(client):
    h=account(client,'a@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Meu cartão','closing_day':25,'due_day':5}).json()['id']
    assert transaction(client,h,payment='debit',card_id=card,purchased_on='2026-01-26',installments=1).status_code==201
    january=client.get('/api/dashboard?month=2026-01',headers=h).json()['entries']
    assert len(january)==1
    assert january[0]['card_id']==card and january[0]['payment']=='debit'
    assert january[0]['due_date']=='2026-01-26'
    assert transaction(client,h,payment='credit',card_id=card,purchased_on='2026-01-26',installments=1).status_code==201
    march=client.get('/api/dashboard?month=2026-03',headers=h).json()['entries']
    assert len(march)==1 and march[0]['payment']=='credit'
    assert march[0]['card_id']==card and march[0]['due_date']=='2026-03-05'

def test_debit_card_ownership_and_payment_validation(client):
    a=account(client,'a@example.com'); b=account(client,'b@example.com')
    card=client.post('/api/cards',headers=a,json={'name':'Privado','closing_day':10,'due_day':20}).json()['id']
    assert transaction(client,b,payment='debit',card_id=card).status_code==404
    assert transaction(client,a,payment='debit',card_id=999999).status_code==404
    assert transaction(client,a,payment='pix',card_id=card).status_code==422
    assert transaction(client,a,payment='debit').status_code==201

def test_reimbursement_tracks_each_installment_separately(client):
    h=account(client,'a@example.com'); other=account(client,'b@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':25,'due_day':5}).json()['id']
    assert transaction(client,h,payment='credit',card_id=card,reimbursement_person=' Ana ',purchased_on='2026-01-25').status_code==201
    feb=client.get('/api/dashboard?month=2026-02',headers=h).json()
    row=feb['entries'][0]
    assert row['reimbursement_person']=='Ana' and not row['reimbursement_received']
    url='/api/entries/'+str(row['id'])+'/reimbursement'
    assert client.patch(url,headers=other,json={'received':True}).status_code==404
    assert client.patch(url,headers=h,json={'received':True}).status_code==200
    updated=client.get('/api/dashboard?month=2026-02',headers=h).json()
    assert updated['entries'][0]['reimbursement_received']
    assert not updated['entries'][0]['paid']
    assert updated['expenses']==3334 and updated['income']==0 and updated['pending']==3334
    assert not client.get('/api/dashboard?month=2026-03',headers=h).json()['entries'][0]['reimbursement_received']
    assert client.patch(url,headers=h,json={'received':False}).status_code==200

def test_reimbursement_validation(client):
    h=account(client,'a@example.com')
    assert transaction(client,h,reimbursement_person='Ana').status_code==422
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':25,'due_day':5}).json()['id']
    assert transaction(client,h,payment='credit',kind='income',card_id=card,reimbursement_person='Ana').status_code==422
    assert transaction(client,h).status_code==201
    row=client.get('/api/dashboard?month=2026-01',headers=h).json()['entries'][0]
    assert client.patch('/api/entries/'+str(row['id'])+'/reimbursement',headers=h,json={'received':True}).status_code==422

def test_simple_income_without_expense_fields(client):
    h=account(client,'a@example.com')
    payload={'description':'Bolsa do Projeto — outubro','source':' Projeto de pesquisa ','amount':'1600.00','purchased_on':'2026-10-01','kind':'income'}
    assert client.post('/api/transactions',headers=h,json=payload).status_code==201
    dashboard=client.get('/api/dashboard?month=2026-10',headers=h).json()
    assert dashboard['income']==160000 and dashboard['expenses']==0
    entry=dashboard['entries'][0]
    assert entry['source']=='Projeto de pesquisa'
    assert entry['description']==payload['description']
    assert entry['due_date']=='2026-10-01' and entry['installments']==1
    assert entry['card_id'] is None and entry['payment']=='received'
    assert client.get('/api/dashboard?month=2026-11',headers=h).json()['entries']==[]
    payload['source']=' '
    assert client.post('/api/transactions',headers=h,json=payload).status_code==422
    payload['kind']='expense'
    assert client.post('/api/transactions',headers=h,json=payload).status_code==422

def test_notebook_debt_and_payment(client):
    h=account(client,'a@example.com')
    assert transaction(client,h,payment='notebook',creditor=' Ana ',installments=1).status_code==201
    dashboard=client.get('/api/dashboard?month=2026-01',headers=h).json()
    entry=dashboard['entries'][0]
    assert entry['creditor']=='Ana' and entry['payment']=='notebook'
    assert entry['card_id'] is None and not entry['paid']
    assert dashboard['expenses']==10000 and dashboard['pending']==10000
    assert client.patch('/api/entries/'+str(entry['id']),headers=h,json={'paid':True}).status_code==200
    assert client.get('/api/dashboard?month=2026-01',headers=h).json()['pending']==0
    assert transaction(client,h,payment='notebook').status_code==422
    assert transaction(client,h,payment='notebook',creditor=' ').status_code==422
    assert transaction(client,h,payment='notebook',creditor='Ana',kind='income').status_code==422
    assert transaction(client,h,payment='pix',creditor='Ana').status_code==422

def test_purchase_total_and_payer_tags(client):
    h=account(client,'a@example.com'); other=account(client,'b@example.com')
    tag=client.post('/api/person-tags',headers=h,json={'name':' Ana '}).json()
    assert tag['name']=='Ana'
    assert client.post('/api/person-tags',headers=h,json={'name':'Ana'}).json()['id']==tag['id']
    assert client.get('/api/person-tags',headers=other).json()==[]
    assert transaction(client,other,payer_tag_id=tag['id']).status_code==404
    assert client.patch('/api/person-tags/'+str(tag['id']),headers=other,json={'name':'Outra'}).status_code==404
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':25,'due_day':5}).json()['id']
    assert transaction(client,h,payment='credit',card_id=card,payer_tag_id=tag['id'],purchased_on='2026-01-25').status_code==201
    feb=client.get('/api/dashboard?month=2026-02',headers=h).json()
    row=feb['entries'][0]
    assert row['total_amount']==10000 and row['amount']==3334
    assert feb['expenses']==3334 and feb['pending']==3334
    assert row['payer_tag_id']==tag['id'] and row['payer_tag']=='Ana' and row['reimbursement_person']=='Ana'
    assert client.patch('/api/person-tags/'+str(tag['id']),headers=h,json={'name':'Ana Maria'}).status_code==200
    row=client.get('/api/dashboard?month=2026-03',headers=h).json()['entries'][0]
    assert row['payer_tag']=='Ana Maria' and row['reimbursement_person']=='Ana Maria'
    assert row['total_amount']==10000 and row['amount']==3333
    assert transaction(client,h,payment='pix',payer_tag_id=tag['id']).status_code==201
    assert client.post('/api/person-tags',headers=h,json={'name':' '}).status_code==422
    assert transaction(client,h,kind='income',payer_tag_id=tag['id']).status_code==422

def test_legacy_reimbursement_creates_reusable_tag(client):
    h=account(client,'a@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':25,'due_day':5}).json()['id']
    assert transaction(client,h,payment='credit',card_id=card,reimbursement_person=' Ana ',purchased_on='2026-01-25').status_code==201
    tags=client.get('/api/person-tags',headers=h).json()
    assert len(tags)==1 and tags[0]['name']=='Ana'
    row=client.get('/api/dashboard?month=2026-02',headers=h).json()['entries'][0]
    assert row['payer_tag_id']==tags[0]['id']

def test_partial_card_payment_preserves_expenses_and_reduces_invoice_pending(client):
    h=account(client,'a@example.com'); other=account(client,'b@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':25,'due_day':5}).json()['id']
    tag=client.post('/api/person-tags',headers=h,json={'name':'Ana'}).json()['id']
    assert transaction(client,h,payment='credit',card_id=card,installments=1,purchased_on='2026-01-25').status_code==201
    body={'card_id':card,'payer_tag_id':tag,'amount':'30.25','paid_on':'2026-01-25'}
    response=client.post('/api/card-payments',headers=h,json=body)
    assert response.status_code==201 and response.json()['invoice_month']=='2026-02'
    ident=response.json()['id']
    dashboard=client.get('/api/dashboard?month=2026-02',headers=h).json()
    assert dashboard['expenses']==10000 and dashboard['income']==0 and dashboard['balance']==-10000
    assert dashboard['pending']==6975
    payment=dashboard['card_payments'][0]
    assert payment['payer_tag']=='Ana' and payment['amount']==3025 and payment['paid_on']=='2026-01-25'
    assert not dashboard['entries'][0]['paid']
    assert client.get('/api/dashboard?month=2026-02',headers=other).json()['card_payments']==[]
    assert client.post('/api/card-payments',headers=other,json=body).status_code==404
    other_card=client.post('/api/cards',headers=other,json={'name':'Outro','closing_day':25,'due_day':5}).json()['id']
    assert client.post('/api/card-payments',headers=other,json={**body,'card_id':other_card}).status_code==404
    assert client.delete('/api/card-payments/'+str(ident),headers=other).status_code==404
    assert client.post('/api/card-payments',headers=h,json={**body,'amount':'100.00'}).status_code==201
    assert client.get('/api/dashboard?month=2026-02',headers=h).json()['pending']==0
    assert client.delete('/api/card-payments/'+str(ident),headers=h).status_code==204
    assert client.get('/api/dashboard?month=2026-02',headers=h).json()['expenses']==10000

@pytest.mark.parametrize('paid_on,closing,due,expected',[
    ('2026-01-25',25,5,'2026-02'),('2026-01-26',25,5,'2026-03'),
    ('2026-12-26',25,5,'2027-02'),('2026-02-28',31,31,'2026-03'),
    ('2026-01-10',10,20,'2026-01'),('2026-01-11',10,20,'2026-02')])
def test_partial_payment_current_invoice(client,paid_on,closing,due,expected):
    h=account(client,'a@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':closing,'due_day':due}).json()['id']
    response=client.post('/api/card-payments',headers=h,json={'card_id':card,'amount':'12.34','paid_on':paid_on})
    assert response.status_code==201 and response.json()['invoice_month']==expected

def test_partial_payment_manual_invoice_validation_and_paid_status(client):
    h=account(client,'a@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':25,'due_day':5}).json()['id']
    assert transaction(client,h,payment='credit',card_id=card,installments=1,purchased_on='2026-01-25').status_code==201
    body={'card_id':card,'amount':'25.00','paid_on':'2026-04-10','invoice_month':'2026-02'}
    response=client.post('/api/card-payments',headers=h,json=body)
    assert response.status_code==201 and response.json()['invoice_month']=='2026-02'
    feb=client.get('/api/dashboard?month=2026-02',headers=h).json()
    assert feb['pending']==7500
    assert client.get('/api/dashboard?month=2026-05',headers=h).json()['card_payments']==[]
    entry=feb['entries'][0]['id']
    assert client.patch('/api/entries/'+str(entry),headers=h,json={'paid':True}).status_code==200
    assert client.get('/api/dashboard?month=2026-02',headers=h).json()['pending']==0
    for update in [{'amount':'0'},{'amount':'10.001'},{'invoice_month':'2026-13'},{'invoice_month':'0000-01'},{'paid_on':'2026-02-30'}]:
        assert client.post('/api/card-payments',headers=h,json={**body,**update}).status_code==422

def test_edit_purchase_recalculates_installments_and_preserves_status(client):
    h=account(client,'a@example.com'); other=account(client,'b@example.com')
    ident=transaction(client,h).json()['id']
    url='/api/transactions/'+str(ident)
    original=client.get(url,headers=h).json()
    assert original['amount']==10000 and original['purchased_on']=='2026-01-31'
    assert client.get(url,headers=other).status_code==404
    first=client.get('/api/dashboard?month=2026-01',headers=h).json()['entries'][0]
    assert client.patch('/api/entries/'+str(first['id']),headers=h,json={'paid':True}).status_code==200
    payload={**original,'amount':'120.01','description':'Compra corrigida','purchased_on':'2026-02-15','installments':4}
    assert client.put(url,headers=other,json=payload).status_code==404
    assert client.put(url,headers=h,json=payload).status_code==200
    assert client.get('/api/dashboard?month=2026-01',headers=h).json()['entries']==[]
    rows=[client.get('/api/dashboard?month='+m,headers=h).json()['entries'][0] for m in ['2026-02','2026-03','2026-04','2026-05']]
    assert [r['amount'] for r in rows]==[3001,3000,3000,3000]
    assert rows[0]['id']==first['id'] and rows[0]['paid']
    assert all(r['total_amount']==12001 and r['description']=='Compra corrigida' for r in rows)
    assert not rows[3]['paid']
    assert client.put(url,headers=h,json={**payload,'installments':2}).status_code==200
    assert client.get('/api/dashboard?month=2026-04',headers=h).json()['entries']==[]
    second=client.get('/api/dashboard?month=2026-03',headers=h).json()['entries'][0]
    assert client.patch('/api/entries/'+str(second['id']),headers=h,json={'paid':True}).status_code==200
    assert client.put(url,headers=h,json={**payload,'installments':1}).status_code==422
    assert client.get(url,headers=h).json()['installments']==2

def test_edit_purchase_card_category_tag_validation_and_reimbursements(client):
    h=account(client,'a@example.com'); other=account(client,'b@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':25,'due_day':5}).json()['id']
    ana=client.post('/api/person-tags',headers=h,json={'name':'Ana'}).json()['id']
    bia=client.post('/api/person-tags',headers=h,json={'name':'Bia'}).json()['id']
    ident=transaction(client,h,payment='credit',card_id=card,payer_tag_id=ana,purchased_on='2026-01-25').json()['id']
    url='/api/transactions/'+str(ident)
    payload={**client.get(url,headers=h).json(),'amount':'100.00'}
    row=client.get('/api/dashboard?month=2026-02',headers=h).json()['entries'][0]
    assert client.patch('/api/entries/'+str(row['id'])+'/reimbursement',headers=h,json={'received':True}).status_code==200
    assert client.put(url,headers=h,json={**payload,'description':'Corrigida'}).status_code==200
    assert client.get('/api/dashboard?month=2026-02',headers=h).json()['entries'][0]['reimbursement_received']
    assert client.put(url,headers=h,json={**payload,'payer_tag_id':bia}).status_code==200
    assert not client.get('/api/dashboard?month=2026-02',headers=h).json()['entries'][0]['reimbursement_received']
    foreign_category=client.get('/api/categories',headers=other).json()[0]['id']
    assert client.put(url,headers=h,json={**payload,'category_id':foreign_category}).status_code==404
    assert client.put(url,headers=h,json={**payload,'amount':'0.01'}).status_code==422
    assert client.put(url,headers=h,json={**payload,'payer_tag_id':None,'reimbursement_person':None,'payment':'pix','card_id':None}).status_code==200
    row=client.get('/api/dashboard?month=2026-01',headers=h).json()['entries'][0]
    assert row['payment']=='pix' and row['reimbursement_person'] is None

def test_edit_simple_income(client):
    h=account(client,'a@example.com')
    payload={'description':'Bolsa','source':'Projeto','amount':'100.00','kind':'income','purchased_on':'2026-10-01'}
    ident=client.post('/api/transactions',headers=h,json=payload).json()['id']
    assert client.put('/api/transactions/'+str(ident),headers=h,json={**payload,'amount':'200.00','source':'Empresa'}).status_code==200
    data=client.get('/api/dashboard?month=2026-10',headers=h).json()
    assert data['income']==20000 and data['entries'][0]['source']=='Empresa'

def test_edit_partial_payment_moves_invoice_and_preserves_record(client):
    h=account(client,'a@example.com'); other=account(client,'b@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':25,'due_day':5}).json()['id']
    tag=client.post('/api/person-tags',headers=h,json={'name':'Ana'}).json()['id']
    payload={'card_id':card,'amount':'30.00','paid_on':'2026-01-25'}
    ident=client.post('/api/card-payments',headers=h,json=payload).json()['id']
    url='/api/card-payments/'+str(ident)
    edited={**payload,'payer_tag_id':tag,'amount':'45.67','paid_on':'2026-01-26','invoice_month':'2026-04','description':'Pagamento corrigido'}
    assert client.put(url,headers=other,json=edited).status_code==404
    assert client.put(url,headers=h,json=edited).status_code==200
    assert client.get('/api/dashboard?month=2026-02',headers=h).json()['card_payments']==[]
    row=client.get('/api/dashboard?month=2026-04',headers=h).json()['card_payments'][0]
    assert row['id']==ident and row['amount']==4567 and row['payer_tag']=='Ana' and row['description']=='Pagamento corrigido'
    assert client.put(url,headers=h,json={**edited,'amount':'0'}).status_code==422
    assert client.put(url,headers=h,json={**edited,'invoice_month':None}).json()['invoice_month']=='2026-03'

def test_move_single_installment_to_selected_invoice(client):
    h=account(client,'a@example.com'); other=account(client,'b@example.com')
    card=client.post('/api/cards',headers=h,json={'name':'Cartão','closing_day':25,'due_day':31}).json()['id']
    tag=client.post('/api/person-tags',headers=h,json={'name':'Ana'}).json()['id']
    ident=transaction(client,h,payment='credit',card_id=card,payer_tag_id=tag,purchased_on='2026-01-25').json()['id']
    url='/api/transactions/'+str(ident)
    record=client.get(url,headers=h).json()
    row=client.get('/api/dashboard?month=2026-01',headers=h).json()['entries'][0]
    client.patch('/api/entries/'+str(row['id']),headers=h,json={'paid':True})
    client.patch('/api/entries/'+str(row['id'])+'/reimbursement',headers=h,json={'received':True})
    payload={**record,'amount':'100.00','entry_months':{'1':'2026-04'}}
    assert client.put(url,headers=other,json=payload).status_code==404
    assert client.put(url,headers=h,json=payload).status_code==200
    assert client.get('/api/dashboard?month=2026-01',headers=h).json()['entries']==[]
    moved=client.get('/api/dashboard?month=2026-04',headers=h).json()['entries'][0]
    assert moved['id']==row['id'] and moved['amount']==3334 and moved['due_date']=='2026-04-30'
    assert moved['paid'] and moved['reimbursement_received']
    assert client.get('/api/dashboard?month=2026-02',headers=h).json()['entries'][0]['due_date']=='2026-02-28'
    assert client.get('/api/dashboard?month=2026-03',headers=h).json()['entries'][0]['due_date']=='2026-03-31'
    assert client.put(url,headers=h,json={**record,'amount':'100.00','description':'Corrigida'}).status_code==200
    assert client.get('/api/dashboard?month=2026-04',headers=h).json()['entries'][0]['id']==row['id']
    assert client.get(url,headers=h).json()['purchased_on']=='2026-01-25'
    for override in [{'1':'2026-13'},{'1':'0000-01'},{'1':'2026-2'},{'0':'2026-04'},{'4':'2026-04'}]:
        assert client.put(url,headers=h,json={**payload,'entry_months':override}).status_code==422
    assert client.put(url,headers=h,json={**payload,'payment':'pix','card_id':None,'reimbursement_person':None,'payer_tag_id':None}).status_code==422

def test_delete_unused_category_and_user_isolation(client):
    owner=account(client,'owner@example.com'); other=account(client,'other@example.com')
    category=client.post('/api/categories',headers=owner,json={'name':'Temporária'}).json()
    url='/api/categories/'+str(category['id'])
    assert client.get(url+'/usage',headers=owner).json()=={'transaction_count':0}
    assert client.get(url+'/usage',headers=other).status_code==404
    assert client.delete(url,headers=other).status_code==404
    assert client.delete(url).status_code==401
    assert category in client.get('/api/categories',headers=owner).json()
    assert client.delete(url,headers=owner).status_code==204
    assert category not in client.get('/api/categories',headers=owner).json()
    assert client.get(url+'/usage',headers=owner).status_code==404
    assert client.delete(url,headers=owner).status_code==404


def test_used_category_requires_distinct_owned_destination(client):
    owner=account(client,'owner@example.com'); other=account(client,'other@example.com')
    category=client.post('/api/categories',headers=owner,json={'name':'Origem'}).json()
    tx=transaction(client,owner,category_id=category['id']).json()['id']
    foreign=client.get('/api/categories',headers=other).json()[0]['id']
    url='/api/categories/'+str(category['id'])
    assert client.get(url+'/usage',headers=owner).json()=={'transaction_count':1} # One purchase, three installments.
    assert client.delete(url,headers=owner).status_code==409
    assert client.delete(url+'?replacement_id='+str(category['id']),headers=owner).status_code==422
    assert client.delete(url+'?replacement_id='+str(foreign),headers=owner).status_code==404
    assert client.delete(url+'?replacement_id=999999',headers=owner).status_code==404
    assert category in client.get('/api/categories',headers=owner).json()
    assert client.get('/api/transactions/'+str(tx),headers=owner).json()['category_id']==category['id']
    for month in ['2026-01','2026-02','2026-03']:
        entries=client.get('/api/dashboard?month='+month,headers=owner).json()['entries']
        assert len(entries)==1 and entries[0]['category']=='Origem'


def test_delete_category_moves_all_months_preserving_purchases_payments_and_reimbursements(client):
    owner=account(client,'owner@example.com')
    source=client.post('/api/categories',headers=owner,json={'name':'Origem'}).json()
    target=client.post('/api/categories',headers=owner,json={'name':'Destino'}).json()
    card=client.post('/api/cards',headers=owner,json={'name':'Cartão','closing_day':25,'due_day':5}).json()['id']
    tag=client.post('/api/person-tags',headers=owner,json={'name':'Ana'}).json()['id']
    purchase=transaction(client,owner,category_id=source['id'],payment='credit',card_id=card,payer_tag_id=tag,purchased_on='2026-01-25').json()['id']
    refund=transaction(client,owner,category_id=source['id'],payment='credit',card_id=card,purchased_on='2026-01-25',kind='income',amount='15.50',installments=1).json()['id']
    first=client.get('/api/dashboard?month=2026-02',headers=owner).json()['entries'][0]['id']
    assert client.patch('/api/entries/'+str(first),headers=owner,json={'paid':True}).status_code==200
    assert client.patch('/api/entries/'+str(first)+'/reimbursement',headers=owner,json={'received':True}).status_code==200
    assert client.post('/api/card-payments',headers=owner,json={'card_id':card,'amount':'20.00','paid_on':'2026-02-01','invoice_month':'2026-02','description':'Pagamento','payer_tag_id':tag}).status_code==201
    months=['2026-02','2026-03','2026-04']
    before={month:client.get('/api/dashboard?month='+month,headers=owner).json() for month in months}
    records={ident:client.get('/api/transactions/'+str(ident),headers=owner).json() for ident in [purchase,refund]}
    url='/api/categories/'+str(source['id'])
    assert client.get(url+'/usage',headers=owner).json()=={'transaction_count':2}
    assert client.delete(url+'?replacement_id='+str(target['id']),headers=owner).status_code==204
    assert source not in client.get('/api/categories',headers=owner).json()
    for month in months:
        after=client.get('/api/dashboard?month='+month,headers=owner).json()
        assert after=={**before[month],'entries':[{**entry,'category':'Destino'} for entry in before[month]['entries']]}
    for ident,record in records.items():
        assert client.get('/api/transactions/'+str(ident),headers=owner).json()=={**record,'category_id':target['id']}
    assert client.get('/api/categories/'+str(target['id'])+'/usage',headers=owner).json()=={'transaction_count':2}
