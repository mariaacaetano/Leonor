import os, hashlib, secrets, calendar, re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal
import jwt
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, String, ForeignKey, BigInteger, select, inspect, text, func, update
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker, Session
from sqlalchemy.exc import IntegrityError

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./finance.db')
SECRET = os.getenv('SECRET_KEY')
if not SECRET or len(SECRET) < 32:
    raise RuntimeError('Defina SECRET_KEY com pelo menos 32 caracteres.')
engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}, pool_pre_ping=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False)
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password: Mapped[str]
    full_name: Mapped[str] = mapped_column(String(120), default='', server_default='')
    phone: Mapped[str] = mapped_column(String(30), default='', server_default='')
    country: Mapped[str] = mapped_column(String(80), default='', server_default='')
    state: Mapped[str] = mapped_column(String(120), default='', server_default='')
    city: Mapped[str] = mapped_column(String(120), default='', server_default='')
    birth_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    auth_version: Mapped[int] = mapped_column(default=0, server_default=text('0'))
class Category(Base):
    __tablename__ = 'categories'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    name: Mapped[str] = mapped_column(String(80))
class PersonTag(Base):
    __tablename__ = 'person_tags'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    name: Mapped[str] = mapped_column(String(80))
class Card(Base):
    __tablename__ = 'cards'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    name: Mapped[str]
    closing_day: Mapped[int]
    due_day: Mapped[int]
class CardPayment(Base):
    __tablename__ = 'card_payments'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    card_id: Mapped[int] = mapped_column(ForeignKey('cards.id'), index=True)
    payer_tag_id: Mapped[int | None] = mapped_column(ForeignKey('person_tags.id'), nullable=True)
    invoice_month: Mapped[str] = mapped_column(String(7), index=True)
    paid_on: Mapped[str]
    amount: Mapped[int] = mapped_column(BigInteger)
    description: Mapped[str] = mapped_column(String(200))
class Transaction(Base):
    __tablename__ = 'transactions'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    description: Mapped[str]
    amount: Mapped[int] = mapped_column(BigInteger)
    kind: Mapped[str]
    payment: Mapped[str]
    category_id: Mapped[int] = mapped_column(ForeignKey('categories.id'))
    card_id: Mapped[int | None] = mapped_column(ForeignKey('cards.id'), nullable=True)
    creditor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reimbursement_person: Mapped[str | None] = mapped_column(String(80), nullable=True)
    payer_tag_id: Mapped[int | None] = mapped_column(ForeignKey('person_tags.id'), nullable=True)
    purchased_on: Mapped[str]
    installments: Mapped[int]
class Entry(Base):
    __tablename__ = 'entries'
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey('transactions.id'), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    month: Mapped[str] = mapped_column(index=True)
    due_date: Mapped[str]
    number: Mapped[int]
    amount: Mapped[int] = mapped_column(BigInteger)
    paid: Mapped[bool] = mapped_column(default=False)
    reimbursement_received: Mapped[bool] = mapped_column(default=False, server_default=text('false'))
class Company(Base):
    __tablename__ = 'companies'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    name: Mapped[str] = mapped_column(String(120))
class CompanyRecord(Base):
    __tablename__ = 'company_records'
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id'), index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey('companies.id'), index=True)
    kind: Mapped[str] = mapped_column(String(7))
    description: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200), default='')
    occurred_on: Mapped[str] = mapped_column(String(10))
    amount: Mapped[int] = mapped_column(BigInteger)
    installments: Mapped[int] = mapped_column(default=1)
class CompanyItem(Base):
    __tablename__ = 'company_items'
    id: Mapped[int] = mapped_column(primary_key=True)
    record_id: Mapped[int] = mapped_column(ForeignKey('company_records.id'), index=True)
    description: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[str] = mapped_column(String(24))
    amount: Mapped[int] = mapped_column(BigInteger)
Base.metadata.create_all(engine)
# Additive migration preserves existing accounts, purchases and payment statuses.
def migrate_schema(database_engine):
    with database_engine.begin() as connection:
        for table, column, definition in [
            ('transactions', 'payer_tag_id', 'INTEGER REFERENCES person_tags(id)'),
            ('transactions', 'creditor', 'VARCHAR(120)'),
            ('transactions', 'source', 'VARCHAR(120)'),
            ('transactions', 'reimbursement_person', 'VARCHAR(80)'),
            ('entries', 'reimbursement_received', 'BOOLEAN NOT NULL DEFAULT false'),
            ('users', 'full_name', "VARCHAR(120) NOT NULL DEFAULT ''"),
            ('users', 'phone', "VARCHAR(30) NOT NULL DEFAULT ''"),
            ('users', 'country', "VARCHAR(80) NOT NULL DEFAULT ''"),
            ('users', 'state', "VARCHAR(120) NOT NULL DEFAULT ''"),
            ('users', 'city', "VARCHAR(120) NOT NULL DEFAULT ''"),
            ('users', 'birth_date', 'VARCHAR(10)'),
            ('users', 'auth_version', 'INTEGER NOT NULL DEFAULT 0'),
        ]:
            if column not in {c['name'] for c in inspect(connection).get_columns(table)}:
                connection.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {definition}'))
migrate_schema(engine)
# Convert existing reimbursement names to reusable tags without losing history.
with SessionLocal() as session:
    for purchase in session.scalars(select(Transaction).where(Transaction.reimbursement_person.is_not(None), Transaction.payer_tag_id.is_(None))):
        name = purchase.reimbursement_person.strip()
        if not name: continue
        tag = session.scalar(select(PersonTag).where(PersonTag.user_id == purchase.user_id, PersonTag.name == name))
        if tag is None:
            tag = PersonTag(user_id=purchase.user_id, name=name); session.add(tag); session.flush()
        purchase.payer_tag_id = tag.id
    session.commit()
app = FastAPI(title='MeuSaldo API')
bearer = HTTPBearer()
DEFAULTS = ['Mercado','Higiene','Delivery','Gasolina','Farmácia','Academia']
def db():
    with SessionLocal() as session: yield session
def current(auth: HTTPAuthorizationCredentials = Depends(bearer), session: Session = Depends(db)):
    try:
        data = jwt.decode(auth.credentials, SECRET, algorithms=['HS256'])
        user = session.get(User, int(data['sub']))
        if not user or data.get('ver', 0) != user.auth_version: raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError, KeyError): raise HTTPException(401, 'Sessão inválida ou expirada')
def owned(session, model, ident, user):
    obj = session.scalar(select(model).where(model.id == ident, model.user_id == user.id))
    if not obj: raise HTTPException(404, 'Registro não encontrado')
    return obj
def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return salt + ':' + digest
class Auth(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)

class RegistrationInput(Auth):
    full_name: str = Field(min_length=3, max_length=120)
    phone: str = Field(min_length=1, max_length=30)
    country: str = Field(default='', max_length=80)
    state: str = Field(default='', max_length=120)
    city: str = Field(default='', max_length=120)

def normalize_phone(value, required=False):
    phone = value.strip()
    if not phone and not required:
        return ''
    if not re.fullmatch(r'\+?[0-9\s().-]+', phone) or not 8 <= len(re.sub(r'\D', '', phone)) <= 15:
        raise HTTPException(422, 'Informe um telefone válido, com DDD ou código do país')
    return phone

def profile_data(user):
    return {'id':user.id, 'email':user.email, 'full_name':user.full_name,
            'phone':user.phone, 'birth_date':user.birth_date,
            'country':user.country, 'state':user.state, 'city':user.city}
def token(user):
    return {'token':jwt.encode({'sub':str(user.id), 'ver':user.auth_version,
                               'exp':datetime.now(timezone.utc)+timedelta(hours=12)}, SECRET, algorithm='HS256'),
            'email':user.email, 'profile':profile_data(user)}
def password_matches(password, encoded):
    return secrets.compare_digest(hash_password(password, encoded.split(':')[0]), encoded)
def normalize_email(value):
    email = value.strip().lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise HTTPException(422, 'E-mail inválido')
    return email
@app.post('/api/register', status_code=201)
def register(body: RegistrationInput, session: Session = Depends(db)):
    email = normalize_email(body.email)
    full_name = body.full_name.strip()
    if len(full_name) < 3:
        raise HTTPException(422, 'Informe seu nome completo')
    phone = normalize_phone(body.phone, required=True)
    if session.scalar(select(User).where(User.email == email)): raise HTTPException(409, 'E-mail já cadastrado')
    user = User(email=email, password=hash_password(body.password), full_name=full_name, phone=phone,
                country=body.country.strip(), state=body.state.strip(), city=body.city.strip())
    session.add(user); session.flush()
    session.add_all([Category(user_id=user.id, name=name) for name in DEFAULTS]); session.commit()
    return token(user)
@app.post('/api/login')
def login(body: Auth, session: Session = Depends(db)):
    user = session.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or not password_matches(body.password, user.password): raise HTTPException(401, 'E-mail ou senha incorretos')
    return token(user)

class ProfileInput(BaseModel):
    full_name: str = Field(default='', max_length=120)
    email: str = Field(min_length=5, max_length=254)
    phone: str = Field(default='', max_length=30)
    country: str = Field(default='', max_length=80)
    state: str = Field(default='', max_length=120)
    city: str = Field(default='', max_length=120)
    birth_date: date | None = None
    current_password: str | None = Field(default=None, max_length=128)

class PasswordInput(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

@app.get('/api/me')
def get_profile(user=Depends(current)):
    return profile_data(user)

def save_account_changes(user, session, values, rotate_session=False):
    if rotate_session:
        values['auth_version'] = User.auth_version + 1
    try:
        result = session.execute(update(User).where(
            User.id == user.id, User.auth_version == user.auth_version
        ).values(**values).execution_options(synchronize_session=False))
        if result.rowcount != 1:
            session.rollback()
            raise HTTPException(409, 'A conta foi atualizada em outra sessão. Recarregue a página e tente novamente.')
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'E-mail já cadastrado')
    session.refresh(user)
    return token(user)

@app.put('/api/me')
def edit_profile(body:ProfileInput, user=Depends(current), session:Session=Depends(db)):
    email = normalize_email(body.email)
    email_changed = email != user.email
    if body.birth_date and body.birth_date > date.today():
        raise HTTPException(422, 'A data de nascimento não pode estar no futuro')
    if email_changed:
        if not body.current_password or not password_matches(body.current_password, user.password):
            raise HTTPException(400, 'Informe a senha atual correta para alterar o e-mail')
        if session.scalar(select(User.id).where(User.email == email, User.id != user.id)):
            raise HTTPException(409, 'E-mail já cadastrado')
    return save_account_changes(user, session, {
        'full_name':body.full_name.strip(), 'phone':normalize_phone(body.phone),
        'birth_date':body.birth_date.isoformat() if body.birth_date else None, 'email':email,
        **{field:getattr(body, field).strip() for field in ('country', 'state', 'city') if field in body.model_fields_set},
    }, rotate_session=email_changed)

@app.put('/api/me/password')
def change_password(body:PasswordInput, user=Depends(current), session:Session=Depends(db)):
    if not password_matches(body.current_password, user.password):
        raise HTTPException(400, 'Senha atual incorreta')
    if body.new_password != body.confirm_password:
        raise HTTPException(422, 'A confirmação da nova senha não confere')
    if password_matches(body.new_password, user.password):
        raise HTTPException(422, 'Escolha uma senha diferente da atual')
    return save_account_changes(user, session, {'password':hash_password(body.new_password)}, rotate_session=True)
class Name(BaseModel): name: str = Field(min_length=1, max_length=80)
@app.get('/api/categories')
def categories(user=Depends(current), session: Session=Depends(db)):
    return [{'id': x.id, 'name': x.name} for x in session.scalars(select(Category).where(Category.user_id == user.id).order_by(Category.name))]
@app.post('/api/categories', status_code=201)
def add_category(body: Name, user=Depends(current), session: Session=Depends(db)):
    item=Category(user_id=user.id,name=body.name.strip()); session.add(item); session.commit(); return {'id':item.id,'name':item.name}
@app.patch('/api/categories/{ident}')
def edit_category(ident:int, body:Name, user=Depends(current), session:Session=Depends(db)):
    item=owned(session,Category,ident,user); item.name=body.name.strip(); session.commit(); return {'id':item.id,'name':item.name}
@app.get('/api/categories/{ident}/usage')
def category_usage(ident:int, user=Depends(current), session:Session=Depends(db)):
    owned(session,Category,ident,user)
    count=session.scalar(select(func.count(Transaction.id)).where(Transaction.user_id==user.id,Transaction.category_id==ident))
    return {'transaction_count':count}
@app.delete('/api/categories/{ident}',status_code=204)
def delete_category(ident:int, replacement_id:int|None=None, user=Depends(current), session:Session=Depends(db)):
    item=owned(session,Category,ident,user)
    if replacement_id==ident: raise HTTPException(422,'Escolha uma categoria diferente para os lançamentos')
    replacement=owned(session,Category,replacement_id,user) if replacement_id is not None else None
    used=session.scalar(select(Transaction.id).where(Transaction.user_id==user.id,Transaction.category_id==ident).limit(1)) is not None
    if used and replacement is None:
        raise HTTPException(409,'Esta categoria possui lançamentos. Escolha outra categoria para eles antes de excluir.')
    if replacement is not None:
        session.execute(update(Transaction).where(Transaction.user_id==user.id,Transaction.category_id==ident).values(category_id=replacement.id))
    session.delete(item); session.commit()
@app.get('/api/person-tags')
def person_tags(user=Depends(current), session:Session=Depends(db)):
    return [{'id':x.id,'name':x.name} for x in session.scalars(select(PersonTag).where(PersonTag.user_id==user.id).order_by(PersonTag.name))]
@app.post('/api/person-tags',status_code=201)
def add_person_tag(body:Name,user=Depends(current),session:Session=Depends(db)):
    name=body.name.strip()
    if not name: raise HTTPException(422,'Informe o nome da pessoa')
    item=session.scalar(select(PersonTag).where(PersonTag.user_id==user.id,PersonTag.name==name))
    if item is None:
        item=PersonTag(user_id=user.id,name=name); session.add(item)
    session.commit(); return {'id':item.id,'name':item.name}
@app.patch('/api/person-tags/{ident}')
def edit_person_tag(ident:int,body:Name,user=Depends(current),session:Session=Depends(db)):
    item=owned(session,PersonTag,ident,user)
    name=body.name.strip()
    if not name: raise HTTPException(422,'Informe o nome da pessoa')
    if session.scalar(select(PersonTag).where(PersonTag.user_id==user.id,PersonTag.name==name,PersonTag.id!=ident)):
        raise HTTPException(409,'Essa tag já existe')
    item.name=name; session.commit(); return {'id':item.id,'name':item.name}
class CardInput(Name):
    closing_day: int = Field(ge=1, le=31)
    due_day: int = Field(ge=1, le=31)
@app.get('/api/cards')
def cards(user=Depends(current), session: Session=Depends(db)):
    return [{'id':x.id,'name':x.name,'closing_day':x.closing_day,'due_day':x.due_day} for x in session.scalars(select(Card).where(Card.user_id==user.id))]
@app.post('/api/cards',status_code=201)
def add_card(body:CardInput,user=Depends(current),session:Session=Depends(db)):
    item=Card(user_id=user.id,**body.model_dump()); session.add(item); session.commit(); return {'id':item.id}
class TransactionInput(BaseModel):
    description: str = Field(min_length=1,max_length=200)
    amount: Decimal = Field(gt=0,le=100000000,decimal_places=2)
    kind: Literal['expense','income']
    payment: Literal['pix','cash','debit','credit','transfer','boleto','received','notebook'] | None = None
    category_id: int | None = None
    creditor: str | None = Field(default=None, max_length=120)
    source: str | None = Field(default=None, max_length=120)
    card_id: int | None = None
    reimbursement_person: str | None = Field(default=None, max_length=80)
    payer_tag_id: int | None = None
    entry_months: dict[int,str] | None = None
    purchased_on: date
    installments: int = Field(default=1,ge=1,le=120)
def shift_month(day, offset, target_day=None):
    m=day.year*12+day.month-1+offset; year,month=divmod(m,12); month+=1
    return date(year,month,min(target_day or day.day,calendar.monthrange(year,month)[1]))
def invoice_due_date(card, day):
    closing=min(card.closing_day,calendar.monthrange(day.year,day.month)[1])
    return shift_month(day,int(day.day>closing)+int(card.due_day<=card.closing_day),card.due_day)
class CardPaymentInput(BaseModel):
    card_id: int
    payer_tag_id: int | None = None
    amount: Decimal = Field(gt=0,le=100000000,decimal_places=2)
    paid_on: date
    invoice_month: str | None = Field(default=None,pattern=r'^\d{4}-(0[1-9]|1[0-2])$')
    description: str = Field(default='Pagamento parcial do cartão',min_length=1,max_length=200)
@app.post('/api/card-payments',status_code=201)
def add_card_payment(body:CardPaymentInput,user=Depends(current),session:Session=Depends(db)):
    return save_card_payment(body,user,session)
@app.put('/api/card-payments/{ident}')
def edit_card_payment(ident:int,body:CardPaymentInput,user=Depends(current),session:Session=Depends(db)):
    item=owned(session,CardPayment,ident,user)
    return save_card_payment(body,user,session,item)
def save_card_payment(body,user,session,item=None):
    card=owned(session,Card,body.card_id,user)
    if body.payer_tag_id is not None: owned(session,PersonTag,body.payer_tag_id,user)
    month=body.invoice_month or invoice_due_date(card,body.paid_on).strftime('%Y-%m')
    try: date.fromisoformat(month+'-01')
    except ValueError: raise HTTPException(422,'Fatura inválida')
    values=dict(card_id=card.id,payer_tag_id=body.payer_tag_id,amount=int(body.amount*100),paid_on=body.paid_on.isoformat(),invoice_month=month,description=body.description)
    if item is None: item=CardPayment(user_id=user.id,**values)
    else:
        for key,value in values.items(): setattr(item,key,value)
    session.add(item); session.commit()
    return {'id':item.id,'invoice_month':month}
@app.delete('/api/card-payments/{ident}',status_code=204)
def delete_card_payment(ident:int,user=Depends(current),session:Session=Depends(db)):
    item=owned(session,CardPayment,ident,user); session.delete(item); session.commit()
@app.post('/api/transactions',status_code=201)
def add_transaction(body:TransactionInput,user=Depends(current),session:Session=Depends(db)):
    return save_transaction(body,user,session)
@app.get('/api/transactions/{ident}')
def get_transaction(ident:int,user=Depends(current),session:Session=Depends(db)):
    item=owned(session,Transaction,ident,user)
    return {**{column.name:getattr(item,column.name) for column in Transaction.__table__.columns if column.name!='user_id'},'entry_schedule':[{'number':e.number,'month':e.month} for e in session.scalars(select(Entry).where(Entry.transaction_id==item.id,Entry.user_id==user.id).order_by(Entry.number))]}
@app.put('/api/transactions/{ident}')
def edit_transaction(ident:int,body:TransactionInput,user=Depends(current),session:Session=Depends(db)):
    item=owned(session,Transaction,ident,user)
    return save_transaction(body,user,session,item)
def save_transaction(body,user,session,item=None):
    body.creditor = (body.creditor or '').strip() or None
    if body.payment=='notebook':
        if body.kind!='expense': raise HTTPException(422,'Caderninho só é permitido em saídas')
        if not body.creditor: raise HTTPException(422,'Informe a quem você deve')
    elif body.creditor:
        raise HTTPException(422,'Credor só é permitido no caderninho')
    body.source = (body.source or '').strip() or None
    if body.kind=='income' and body.payment is None:
        if not body.source: raise HTTPException(422,'Informe de onde veio a entrada')
        body.payment='received'
        body.card_id=None
        body.installments=1
        body.reimbursement_person=None
    if body.kind=='expense' and (body.payment is None or body.payment=='received'):
        raise HTTPException(422,'Informe a forma de pagamento')
    if body.category_id is None:
        if body.kind=='expense': raise HTTPException(422,'Selecione uma categoria')
        category=session.scalar(select(Category).where(Category.user_id==user.id,Category.name=='Outros'))
        if category is None:
            category=Category(user_id=user.id,name='Outros'); session.add(category); session.flush()
        body.category_id=category.id
    owned(session,Category,body.category_id,user)
    card=None
    if body.payment=='credit':
        if not body.card_id: raise HTTPException(422,'Selecione um cartão')
        card=owned(session,Card,body.card_id,user)
    elif body.payment=='debit' and body.card_id:
        owned(session,Card,body.card_id,user)
    elif body.card_id: raise HTTPException(422,'Cartão só é permitido no crédito ou débito')
    body.reimbursement_person = (body.reimbursement_person or '').strip() or None
    if body.reimbursement_person and (body.payment!='credit' or body.kind!='expense'):
        raise HTTPException(422,'Reembolso só é permitido em compras no cartão de crédito')
    if body.payer_tag_id is not None:
        if body.kind!='expense': raise HTTPException(422,'Pessoa que paga só é permitida em gastos')
        tag=owned(session,PersonTag,body.payer_tag_id,user)
        body.reimbursement_person=tag.name if body.payment=='credit' else None
    elif body.reimbursement_person:
        # Compatibility with older clients; all names become reusable tags.
        tag=session.scalar(select(PersonTag).where(PersonTag.user_id==user.id,PersonTag.name==body.reimbursement_person))
        if tag is None:
            tag=PersonTag(user_id=user.id,name=body.reimbursement_person); session.add(tag); session.flush()
        body.payer_tag_id=tag.id
    cents=int((body.amount*100).quantize(Decimal('1'),rounding=ROUND_HALF_UP))
    if cents < body.installments: raise HTTPException(422,'Valor insuficiente para o número de parcelas')
    if body.entry_months:
        if body.payment!='credit': raise HTTPException(422,'Seleção de fatura só é permitida no crédito')
        for number,month in body.entry_months.items():
            if number<1 or number>body.installments: raise HTTPException(422,'Parcela inválida')
            try:
                parsed=date.fromisoformat(month+'-01')
                if parsed.strftime('%Y-%m')!=month: raise ValueError()
            except ValueError: raise HTTPException(422,'Fatura inválida')
    existing={}
    preserve_schedule=False
    payer_changed=False
    if item is not None:
        preserve_schedule=(item.purchased_on==body.purchased_on.isoformat() and item.payment==body.payment and item.card_id==body.card_id and item.installments==body.installments)
        existing={entry.number:entry for entry in session.scalars(select(Entry).where(Entry.transaction_id==item.id,Entry.user_id==user.id))}
        if any((entry.paid or entry.reimbursement_received) and number>body.installments for number,entry in existing.items()):
            raise HTTPException(422,'Não é possível remover parcelas já pagas ou com reembolso recebido')
        payer_changed=item.payer_tag_id!=body.payer_tag_id or item.payment!=body.payment
    values={**body.model_dump(exclude={'amount','purchased_on','entry_months'}),'amount':cents,'purchased_on':body.purchased_on.isoformat()}
    if item is None: item=Transaction(user_id=user.id,**values)
    else:
        for key,value in values.items(): setattr(item,key,value)
    session.add(item); session.flush()
    first=body.purchased_on
    if card:
        first=invoice_due_date(card,first)
    base,remainder=divmod(cents,body.installments)
    for i in range(body.installments):
        due=shift_month(first,i,card.due_day if card else body.purchased_on.day)
        entry=existing.pop(i+1,None)
        if entry is not None and preserve_schedule: due=date.fromisoformat(entry.due_date)
        if body.entry_months and i+1 in body.entry_months:
            target=date.fromisoformat(body.entry_months[i+1]+'-01')
            due=shift_month(target,0,card.due_day)
        if entry is None: entry=Entry(transaction_id=item.id,user_id=user.id,number=i+1,paid=False)
        entry.month=due.strftime('%Y-%m'); entry.due_date=due.isoformat(); entry.amount=base+(i<remainder)
        if payer_changed: entry.reimbursement_received=False
        session.add(entry)
    for entry in existing.values(): session.delete(entry)
    session.commit(); return {'id':item.id}
@app.delete('/api/transactions/{ident}',status_code=204)
def delete_transaction(ident:int,user=Depends(current),session:Session=Depends(db)):
    item=owned(session,Transaction,ident,user)
    for entry in session.scalars(select(Entry).where(Entry.transaction_id==ident,Entry.user_id==user.id)): session.delete(entry)
    session.delete(item); session.commit()
class Paid(BaseModel): paid: bool
@app.patch('/api/entries/{ident}')
def mark_paid(ident:int,body:Paid,user=Depends(current),session:Session=Depends(db)):
    item=owned(session,Entry,ident,user); item.paid=body.paid; session.commit(); return {'id':item.id,'paid':item.paid}
class ReimbursementReceived(BaseModel): received: bool
@app.patch('/api/entries/{ident}/reimbursement')
def mark_reimbursement(ident:int,body:ReimbursementReceived,user=Depends(current),session:Session=Depends(db)):
    item=owned(session,Entry,ident,user)
    purchase=owned(session,Transaction,item.transaction_id,user)
    if not purchase.reimbursement_person: raise HTTPException(422,'Compra sem reembolso previsto')
    item.reimbursement_received=body.received
    session.commit()
    return {'id':item.id,'reimbursement_received':item.reimbursement_received}
@app.get('/api/dashboard')
def dashboard(month:str,user=Depends(current),session:Session=Depends(db)):
    try: datetime.strptime(month,'%Y-%m')
    except ValueError: raise HTTPException(422,'Mês inválido')
    rows=session.execute(select(Entry,Transaction,Category).join(Transaction,Entry.transaction_id==Transaction.id).join(Category,Transaction.category_id==Category.id).where(Entry.user_id==user.id,Entry.month==month).order_by(Entry.due_date,Entry.id)).all()
    tags={tag.id:tag.name for tag in session.scalars(select(PersonTag).where(PersonTag.user_id==user.id))}
    entries=[{'id':e.id,'transaction_id':t.id,'description':t.description,'amount':e.amount,'total_amount':t.amount,'payer_tag_id':t.payer_tag_id,'payer_tag':tags.get(t.payer_tag_id),'kind':t.kind,'payment':t.payment,'category':c.name,'source':t.source,'creditor':t.creditor,'card_id':t.card_id,'purchased_on':t.purchased_on,'due_date':e.due_date,'installment':e.number,'installments':t.installments,'paid':e.paid,'reimbursement_person':(tags.get(t.payer_tag_id) or t.reimbursement_person) if t.payment=='credit' else None,'reimbursement_received':e.reimbursement_received} for e,t,c in rows]
    income=sum(e['amount'] for e in entries if e['kind']=='income'); expenses=sum(e['amount'] for e in entries if e['kind']=='expense')
    payments=[{'id':p.id,'card_id':p.card_id,'payer_tag_id':p.payer_tag_id,'payer_tag':tags.get(p.payer_tag_id),'amount':p.amount,'paid_on':p.paid_on,'invoice_month':p.invoice_month,'description':p.description} for p in session.scalars(select(CardPayment).where(CardPayment.user_id==user.id,CardPayment.invoice_month==month).order_by(CardPayment.paid_on,CardPayment.id))]
    pending=sum(e['amount'] for e in entries if e['kind']=='expense' and not e['paid'] and e['payment']!='credit')
    for card_id in {e['card_id'] for e in entries if e['payment']=='credit'}:
        bill=[e for e in entries if e['payment']=='credit' and e['card_id']==card_id]
        total=sum(e['amount']*(1 if e['kind']=='expense' else -1) for e in bill)
        marked=sum(e['amount'] for e in bill if e['kind']=='expense' and e['paid'])
        paid=sum(p['amount'] for p in payments if p['card_id']==card_id)
        pending+=max(0,total-max(marked,paid))
    return {'entries':entries,'card_payments':payments,'income':income,'expenses':expenses,'balance':income-expenses,'pending':pending,'companies':company_monthly_summaries(month,user,session)}
@app.get('/api/health')
def health(): return {'status':'ok'}

# Company finances use separate records so business notes do not duplicate
# personal expenses. New tables are created by the additive metadata setup above.
class CompanyInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)

class CompanyItemInput(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    quantity: Decimal = Field(gt=0, le=100000000, decimal_places=3)
    amount: Decimal = Field(gt=0, le=100000000, decimal_places=2)

class CompanyRecordInput(BaseModel):
    kind: Literal['expense', 'income']
    description: str = Field(min_length=1, max_length=200)
    location: str = Field(default='', max_length=200)
    occurred_on: date
    amount: Decimal = Field(gt=0, le=100000000, decimal_places=2)
    installments: int = Field(default=1, ge=1, le=120)
    items: list[CompanyItemInput] = Field(default_factory=list, max_length=200)

@app.get('/api/companies')
def companies(user=Depends(current), session:Session=Depends(db)):
    return [{'id':c.id, 'name':c.name} for c in session.scalars(
        select(Company).where(Company.user_id == user.id).order_by(Company.name, Company.id))]

@app.post('/api/companies', status_code=201)
def add_company(body:CompanyInput, user=Depends(current), session:Session=Depends(db)):
    return save_company(body, user, session)

@app.patch('/api/companies/{ident}')
def edit_company(ident:int, body:CompanyInput, user=Depends(current), session:Session=Depends(db)):
    return save_company(body, user, session, owned(session, Company, ident, user))

def save_company(body, user, session, item=None):
    name = body.name.strip()
    if not name:
        raise HTTPException(422, 'Informe o nome da empresa')
    if item is None:
        item = Company(user_id=user.id, name=name)
    item.name = name
    session.add(item)
    session.commit()
    return {'id':item.id, 'name':item.name}

@app.delete('/api/companies/{ident}', status_code=204)
def delete_company(ident:int, user=Depends(current), session:Session=Depends(db)):
    company = owned(session, Company, ident, user)
    if session.scalar(select(CompanyRecord.id).where(CompanyRecord.company_id == ident).limit(1)):
        raise HTTPException(409, 'Esta empresa possui registros. Exclua os registros antes de excluir a empresa.')
    session.delete(company)
    session.commit()

def company_record_data(record, items):
    base, remainder = divmod(record.amount, record.installments)
    first = date.fromisoformat(record.occurred_on)
    return {
        'id':record.id, 'kind':record.kind, 'description':record.description,
        'location':record.location, 'occurred_on':record.occurred_on,
        'amount':record.amount, 'installments':record.installments,
        'items':[
            {'description':item.description, 'quantity':item.quantity, 'amount':item.amount,
             'unit_cost':str((Decimal(item.amount) / 100 / Decimal(item.quantity)).quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP))}
            for item in items
        ],
        'schedule':[
            {'number':i+1, 'due_date':shift_month(first, i).isoformat(), 'amount':base + (i < remainder)}
            for i in range(record.installments)
        ],
    }

def company_monthly_summaries(month, user, session):
    summaries = {
        company.id:{'id':company.id, 'name':company.name, 'income':0, 'expenses':0, 'balance':0}
        for company in session.scalars(select(Company).where(Company.user_id == user.id).order_by(Company.name, Company.id))
    }
    if not summaries:
        return []
    year, month_number = map(int, month.split('-'))
    records = session.scalars(select(CompanyRecord).where(
        CompanyRecord.user_id == user.id, CompanyRecord.company_id.in_(summaries)))
    for record in records:
        first = date.fromisoformat(record.occurred_on)
        offset = (year - first.year) * 12 + month_number - first.month
        if 0 <= offset < record.installments:
            base, remainder = divmod(record.amount, record.installments)
            key = 'income' if record.kind == 'income' else 'expenses'
            summaries[record.company_id][key] += base + (offset < remainder)
    for summary in summaries.values():
        summary['balance'] = summary['income'] - summary['expenses']
    return list(summaries.values())

@app.get('/api/companies/{company_id}/ledger')
def company_ledger(company_id:int, month:str, user=Depends(current), session:Session=Depends(db)):
    company = owned(session, Company, company_id, user)
    try:
        parsed = date.fromisoformat(month + '-01')
        if parsed.strftime('%Y-%m') != month:
            raise ValueError()
    except ValueError:
        raise HTTPException(422, 'Mês inválido')
    records = list(session.scalars(select(CompanyRecord).where(
        CompanyRecord.company_id == company_id, CompanyRecord.user_id == user.id
    ).order_by(CompanyRecord.occurred_on.desc(), CompanyRecord.id.desc())))
    grouped_items = {}
    for item in session.scalars(select(CompanyItem).join(CompanyRecord).where(
        CompanyRecord.company_id == company_id, CompanyRecord.user_id == user.id
    ).order_by(CompanyItem.id)):
        grouped_items.setdefault(item.record_id, []).append(item)
    rows = [company_record_data(record, grouped_items.get(record.id, [])) for record in records]
    monthly = {'income':0, 'expenses':0}
    total = {'income':0, 'expenses':0}
    for row in rows:
        key = 'income' if row['kind'] == 'income' else 'expenses'
        total[key] += row['amount']
        monthly[key] += sum(entry['amount'] for entry in row['schedule'] if entry['due_date'][:7] == month)
    monthly['balance'] = monthly['income'] - monthly['expenses']
    total['balance'] = total['income'] - total['expenses']
    return {'company':{'id':company.id, 'name':company.name}, 'records':rows, 'month':month,
            'monthly':monthly, 'total':total}

def save_company_record(body, company_id, user, session, record=None):
    owned(session, Company, company_id, user)
    description = body.description.strip()
    if not description:
        raise HTTPException(422, 'Informe a descrição do registro')
    if body.kind == 'income' and (body.items or body.installments != 1):
        raise HTTPException(422, 'Vendas devem ter um valor de entrada único, sem itens de nota')
    if any(not item.description.strip() for item in body.items):
        raise HTTPException(422, 'Informe a descrição de cada item')
    cents = int(body.amount * 100)
    if body.items and cents != sum(int(item.amount * 100) for item in body.items):
        raise HTTPException(422, 'O valor da nota deve ser igual à soma dos valores totais dos itens')
    if cents < body.installments:
        raise HTTPException(422, 'Valor insuficiente para o número de parcelas')
    try:
        shift_month(body.occurred_on, body.installments - 1)
    except ValueError:
        raise HTTPException(422, 'O parcelamento ultrapassa o limite de datas permitido')
    values = dict(kind=body.kind, description=description, location=body.location.strip(),
                  occurred_on=body.occurred_on.isoformat(), amount=cents, installments=body.installments)
    if record is None:
        record = CompanyRecord(user_id=user.id, company_id=company_id, **values)
        session.add(record)
        session.flush()
    else:
        for key, value in values.items():
            setattr(record, key, value)
        for item in session.scalars(select(CompanyItem).where(CompanyItem.record_id == record.id)):
            session.delete(item)
    session.add_all([CompanyItem(record_id=record.id, description=item.description.strip(),
                                quantity=str(item.quantity), amount=int(item.amount * 100)) for item in body.items])
    session.commit()
    return {'id':record.id}

@app.post('/api/companies/{company_id}/records', status_code=201)
def add_company_record(company_id:int, body:CompanyRecordInput, user=Depends(current), session:Session=Depends(db)):
    return save_company_record(body, company_id, user, session)

@app.put('/api/companies/{company_id}/records/{ident}')
def edit_company_record(company_id:int, ident:int, body:CompanyRecordInput, user=Depends(current), session:Session=Depends(db)):
    owned(session, Company, company_id, user)
    record = owned(session, CompanyRecord, ident, user)
    if record.company_id != company_id:
        raise HTTPException(404, 'Registro não encontrado')
    return save_company_record(body, company_id, user, session, record)

@app.delete('/api/companies/{company_id}/records/{ident}', status_code=204)
def delete_company_record(company_id:int, ident:int, user=Depends(current), session:Session=Depends(db)):
    owned(session, Company, company_id, user)
    record = owned(session, CompanyRecord, ident, user)
    if record.company_id != company_id:
        raise HTTPException(404, 'Registro não encontrado')
    for item in session.scalars(select(CompanyItem).where(CompanyItem.record_id == ident)):
        session.delete(item)
    session.delete(record)
    session.commit()
