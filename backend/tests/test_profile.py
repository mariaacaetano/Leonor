from datetime import date, timedelta, datetime, timezone

import jwt
from sqlalchemy import create_engine, text, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from test_finance import account, client
from app import main


def test_read_and_edit_own_profile_preserves_other_accounts_and_records(client):
    owner = account(client, 'owner@example.com')
    other = account(client, 'other@example.com')
    before = client.get('/api/me', headers=owner).json()
    assert set(before) == {'id', 'email', 'full_name', 'phone', 'birth_date', 'country', 'state', 'city'}
    assert before['full_name'] == 'Pessoa de Teste' and before['phone'] == '(11) 99999-9999' and before['birth_date'] is None
    body = {'email':' OWNER@example.com ', 'full_name':' Maria Silva ', 'phone':' (11) 99999-9999 ', 'birth_date':'2000-05-20'}
    response = client.put('/api/me', headers=owner, json=body)
    assert response.status_code == 200
    updated = response.json()['profile']
    assert updated == {**before, 'full_name':'Maria Silva', 'phone':'(11) 99999-9999', 'birth_date':'2000-05-20'}
    assert client.get('/api/me', headers=owner).json() == updated
    assert client.get('/api/me', headers=other).json()['full_name'] == 'Pessoa de Teste'
    assert len(client.get('/api/categories', headers=owner).json()) == 6
    assert client.put('/api/me', headers=owner, json={key:value for key,value in before.items() if key != 'id'}).status_code == 200
    assert client.get('/api/me', headers=owner).json() == before
    assert client.get('/api/me').status_code == 401
    assert client.put('/api/me', json=body).status_code == 401


def test_email_change_reauthenticates_and_invalidates_old_tokens(client):
    owner = account(client, 'owner@example.com')
    other = account(client, 'other@example.com')
    before = client.get('/api/me', headers=owner).json()
    body = {'email':'new@example.com', 'full_name':'Novo nome'}
    assert client.put('/api/me', headers=owner, json=body).status_code == 400
    assert client.put('/api/me', headers=owner, json={**body, 'current_password':'wrong-password'}).status_code == 400
    assert client.get('/api/me', headers=owner).json() == before
    assert client.put('/api/me', headers=owner, json={**body, 'email':'OTHER@example.com', 'current_password':'safe-password-123'}).status_code == 409
    assert client.get('/api/me', headers=owner).json() == before
    response = client.put('/api/me', headers=owner, json={**body, 'current_password':'safe-password-123'})
    assert response.status_code == 200
    fresh = {'Authorization':'Bearer '+response.json()['token']}
    assert client.get('/api/me', headers=owner).status_code == 401
    assert client.get('/api/me', headers=fresh).json()['email'] == 'new@example.com'
    assert client.post('/api/login', json={'email':'owner@example.com', 'password':'safe-password-123'}).status_code == 401
    assert client.post('/api/login', json={'email':'new@example.com', 'password':'safe-password-123'}).status_code == 200
    assert client.get('/api/me', headers=other).status_code == 200


def test_password_change_verifies_current_password_and_revokes_previous_sessions(client):
    owner = account(client, 'owner@example.com')
    other = account(client, 'other@example.com')
    other_session = client.post('/api/login', json={'email':'owner@example.com', 'password':'safe-password-123'}).json()['token']
    body = {'current_password':'safe-password-123', 'new_password':'new-password-456', 'confirm_password':'new-password-456'}
    assert client.put('/api/me/password', json=body).status_code == 401
    assert client.put('/api/me/password', headers=owner, json={**body, 'current_password':'wrong-password'}).status_code == 400
    assert client.put('/api/me/password', headers=owner, json={**body, 'confirm_password':'different-password'}).status_code == 422
    assert client.put('/api/me/password', headers=owner, json={**body, 'new_password':'short', 'confirm_password':'short'}).status_code == 422
    assert client.put('/api/me/password', headers=owner, json={key:'safe-password-123' for key in body}).status_code == 422
    assert client.get('/api/me', headers=owner).status_code == 200
    response = client.put('/api/me/password', headers=owner, json=body)
    assert response.status_code == 200
    fresh = {'Authorization':'Bearer '+response.json()['token']}
    assert client.get('/api/me', headers=fresh).status_code == 200
    assert client.get('/api/me', headers=owner).status_code == 401
    assert client.get('/api/me', headers={'Authorization':'Bearer '+other_session}).status_code == 401
    assert client.get('/api/me', headers=other).status_code == 200
    assert client.post('/api/login', json={'email':'owner@example.com', 'password':'safe-password-123'}).status_code == 401
    assert client.post('/api/login', json={'email':'owner@example.com', 'password':'new-password-456'}).status_code == 200
    with main.SessionLocal() as session:
        user = session.scalar(select(main.User).where(main.User.email == 'owner@example.com'))
        assert user.password != 'new-password-456' and main.password_matches('new-password-456', user.password)
    assert 'password' not in response.json()['profile'] and 'auth_version' not in response.json()['profile']


def test_profile_validation_does_not_mutate_account(client):
    headers = account(client, 'owner@example.com')
    before = client.get('/api/me', headers=headers).json()
    for invalid in [
        {'email':'invalid'}, {'email':'a b@example.com'}, {'email':'a@@example.com'},
        {'full_name':'a'*121}, {'phone':'1'*31}, {'birth_date':'2000-02-30'},
        {'birth_date':(date.today()+timedelta(days=1)).isoformat()},
    ]:
        response = client.put('/api/me', headers=headers, json={'email':'owner@example.com', **invalid})
        assert response.status_code == 422
        assert client.get('/api/me', headers=headers).json() == before


def test_additive_profile_migration_preserves_legacy_accounts_and_sessions():
    engine = create_engine('sqlite://', connect_args={'check_same_thread':False}, poolclass=StaticPool)
    encoded = main.hash_password('legacy-password-123')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, password VARCHAR NOT NULL)'))
        connection.execute(text('INSERT INTO users (id,email,password) VALUES (1,:email,:password)'), {'email':'legacy@example.com', 'password':encoded})
    main.Base.metadata.create_all(engine)
    main.migrate_schema(engine)
    main.migrate_schema(engine)
    main.SessionLocal.configure(bind=engine)
    try:
        with TestClient(main.app) as client:
            legacy_token = jwt.encode({'sub':'1', 'exp':datetime.now(timezone.utc)+timedelta(hours=1)}, main.SECRET, algorithm='HS256')
            response = client.get('/api/me', headers={'Authorization':'Bearer '+legacy_token})
            assert response.status_code == 200
            assert response.json() == {'id':1, 'email':'legacy@example.com', 'full_name':'', 'phone':'', 'birth_date':None, 'country':'', 'state':'', 'city':''}
            response = client.post('/api/login', json={'email':'legacy@example.com', 'password':'legacy-password-123'})
            assert response.status_code == 200
            with main.SessionLocal() as session:
                assert session.get(main.User, 1).password == encoded
    finally:
        engine.dispose()
