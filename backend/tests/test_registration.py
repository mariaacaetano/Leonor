import pytest
from test_finance import account, client


def registration(**changes):
    return {'email':'new@example.com', 'password':'safe-password-123',
            'full_name':' Maria da Silva ', 'phone':' +55 (11) 99999-9999 ',
            'country':' Brasil ', 'state':' São Paulo ', 'city':' Campinas ', **changes}


def test_registration_saves_contact_and_location_and_login_needs_only_credentials(client):
    response = client.post('/api/register', json=registration())
    assert response.status_code == 201
    profile = response.json()['profile']
    assert profile == {'id':profile['id'], 'email':'new@example.com', 'full_name':'Maria da Silva',
                       'phone':'+55 (11) 99999-9999', 'birth_date':None,
                       'country':'Brasil', 'state':'São Paulo', 'city':'Campinas'}
    headers = {'Authorization':'Bearer '+response.json()['token']}
    assert client.get('/api/me', headers=headers).json() == profile
    assert len(client.get('/api/categories', headers=headers).json()) == 6
    login = client.post('/api/login', json={'email':'new@example.com', 'password':'safe-password-123'})
    assert login.status_code == 200 and login.json()['profile'] == profile
    assert client.post('/api/register', json=registration()).status_code == 409


@pytest.mark.parametrize('field,value', [
    ('full_name',None), ('full_name','   '), ('full_name','a'*121),
    ('phone',None), ('phone',''), ('phone','abc12345678'), ('phone','1234567'),
    ('phone','1'*16), ('phone','1'*31), ('country','x'*81),
    ('state','x'*121), ('city','x'*121),
])
def test_invalid_registration_does_not_create_account(client, field, value):
    body = registration(**{field:value})
    if value is None:
        del body[field]
    assert client.post('/api/register', json=body).status_code == 422
    assert client.post('/api/login', json={'email':body['email'], 'password':body['password']}).status_code == 401


def test_location_and_birth_date_are_not_required_at_registration(client):
    body = {key:value for key,value in registration().items() if key not in ('country','state','city')}
    response = client.post('/api/register', json=body)
    assert response.status_code == 201
    profile = response.json()['profile']
    assert profile['country'] == profile['state'] == profile['city'] == ''
    assert profile['birth_date'] is None


def test_profile_location_is_editable_isolated_and_preserved_when_omitted(client):
    response = client.post('/api/register', json=registration())
    headers = {'Authorization':'Bearer '+response.json()['token']}
    other = account(client, 'other@example.com')
    updated = client.put('/api/me', headers=headers, json={
        'email':'new@example.com', 'full_name':'Maria da Silva', 'phone':'+55 (11) 99999-9999',
        'country':' Portugal ', 'state':' Lisboa ', 'city':' Lisboa ',
    })
    assert updated.status_code == 200
    assert {key:updated.json()['profile'][key] for key in ('country','state','city')} == {
        'country':'Portugal', 'state':'Lisboa', 'city':'Lisboa'}
    assert client.get('/api/me', headers=other).json()['city'] == ''
    updated = client.put('/api/me', headers=headers, json={'email':'new@example.com', 'full_name':'Maria Silva'})
    assert updated.status_code == 200 and updated.json()['profile']['city'] == 'Lisboa'
    for field, value in [('country','x'*81), ('state','x'*121), ('city','x'*121), ('phone','invalid')]:
        assert client.put('/api/me', headers=headers, json={'email':'new@example.com', field:value}).status_code == 422
    cleared = client.put('/api/me', headers=headers, json={'email':'new@example.com', 'country':'', 'state':'', 'city':''})
    assert cleared.status_code == 200 and cleared.json()['profile']['city'] == ''
