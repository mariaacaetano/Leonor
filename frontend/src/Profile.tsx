import {useEffect, useState, type FormEvent} from 'react';
import {Check, Eye, EyeOff, LockKeyhole, UserRound} from 'lucide-react';
import './profile.css';
import LocationFields, {type LocationData} from './LocationFields';

export type ProfileData = {id:number, email:string, full_name:string, phone:string, birth_date:string|null} & LocationData;
export type ProfileInput = {full_name:string, email:string, phone:string, birth_date:string|null, current_password?:string} & LocationData;
export type PasswordInput = {current_password:string, new_password:string, confirm_password:string};
type Props = {profile:ProfileData, onSave:(input:ProfileInput)=>Promise<void>, onPasswordChange:(input:PasswordInput)=>Promise<void>};
const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

export default function Profile({profile, onSave, onPasswordChange}:Props) {
  const [name, setName] = useState(profile.full_name), [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone), [birthDate, setBirthDate] = useState(profile.birth_date || '');
  const [location, setLocation] = useState<LocationData>({country:profile.country||'', state:profile.state||'', city:profile.city||''});
  const [emailPassword, setEmailPassword] = useState('');
  const [passwords, setPasswords] = useState<PasswordInput>({current_password:'', new_password:'', confirm_password:''});
  const [busy, setBusy] = useState<'profile'|'password'|null>(null);
  const [profileError, setProfileError] = useState(''), [passwordError, setPasswordError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(''), [passwordSuccess, setPasswordSuccess] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const emailChanged = email.trim().toLowerCase() !== profile.email;
  useEffect(() => {
    setName(profile.full_name); setEmail(profile.email); setPhone(profile.phone); setBirthDate(profile.birth_date || ''); setEmailPassword('');
    setLocation({country:profile.country||'', state:profile.state||'', city:profile.city||''});
  }, [profile.full_name, profile.email, profile.phone, profile.birth_date, profile.country, profile.state, profile.city]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setProfileError(''); setProfileSuccess(''); setBusy('profile');
    try {
      await onSave({full_name:name.trim(), email:email.trim().toLowerCase(), phone:phone.trim(), birth_date:birthDate || null, ...location, ...(emailChanged ? {current_password:emailPassword} : {})});
      setEmailPassword(''); setProfileSuccess('Informações atualizadas.');
    } catch (error) {setProfileError((error as Error).message);}
    finally {setBusy(null);}
  }
  async function changePassword(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setPasswordError(''); setPasswordSuccess('');
    if (passwords.new_password !== passwords.confirm_password) {setPasswordError('A confirmação da nova senha não confere.'); return;}
    if (passwords.new_password === passwords.current_password) {setPasswordError('Escolha uma senha diferente da atual.'); return;}
    setBusy('password');
    try {
      await onPasswordChange(passwords);
      setPasswords({current_password:'', new_password:'', confirm_password:''}); setShowPasswords(false);
      setPasswordSuccess('Senha alterada. As outras sessões foram encerradas.');
    } catch (error) {setPasswordError((error as Error).message);}
    finally {setBusy(null);}
  }
  function updatePassword(key:keyof PasswordInput, value:string) {
    setPasswords(previous => ({...previous, [key]:value})); setPasswordError(''); setPasswordSuccess('');
  }
  return <div className="profile-view">
    <div className="profile-identity"><span className="profile-avatar">{(profile.full_name || profile.email)[0]?.toUpperCase()}</span><div><h2>{profile.full_name || 'Seu perfil'}</h2><p>{profile.email}</p></div></div>
    <div className="profile-panels">
      <section className="panel profile-panel" aria-labelledby="personal-information-title">
        <div className="panel-title"><div className="profile-panel-heading"><span><UserRound size={21}/></span><div><h2 id="personal-information-title">Informações pessoais</h2><p>Mantenha seus dados de contato atualizados.</p></div></div></div>
        <form onSubmit={save}>
          <fieldset disabled={!!busy}>
            <label>Nome completo<input name="full_name" autoComplete="name" maxLength={120} value={name} onChange={event => {setName(event.target.value); setProfileSuccess('');}} placeholder="Seu nome e sobrenome"/></label>
            <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => {setEmail(event.target.value); setProfileError(''); setProfileSuccess('');}}/></label>
            <div className="form-grid">
              <label>Telefone (opcional)<input name="phone" type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={event => {setPhone(event.target.value); setProfileSuccess('');}} placeholder="(11) 99999-9999"/></label>
              <label>Data de nascimento (opcional)<input name="birth_date" type="date" autoComplete="bday" max={today()} value={birthDate} onChange={event => {setBirthDate(event.target.value); setProfileSuccess('');}}/></label>
            </div>
            <fieldset className="profile-location"><legend>Onde você mora? <span>(opcional)</span></legend><p>País, estado ou região e cidade, sem endereço completo.</p><LocationFields value={location} onChange={value=>{setLocation(value);setProfileSuccess('');}}/></fieldset>
            {emailChanged && <div className="profile-email-confirmation"><p>Confirme sua senha atual para trocar o e-mail de acesso.</p><label>Senha atual para alterar o e-mail<input type="password" autoComplete="current-password" required maxLength={128} value={emailPassword} onChange={event => {setEmailPassword(event.target.value); setProfileError('');}}/></label></div>}
          </fieldset>
          {profileError && <div role="alert" className="error">{profileError}</div>}
          {profileSuccess && <p role="status" className="profile-success"><Check size={16}/>{profileSuccess}</p>}
          <div className="profile-form-actions"><button className="primary" disabled={!!busy}><Check size={16}/>{busy === 'profile' ? 'Salvando…' : 'Salvar informações'}</button></div>
        </form>
      </section>
      <section className="panel profile-panel" aria-labelledby="change-password-title">
        <div className="panel-title"><div className="profile-panel-heading"><span><LockKeyhole size={21}/></span><div><h2 id="change-password-title">Alterar senha</h2><p>Escolha uma senha que você ainda não usa aqui.</p></div></div></div>
        <form onSubmit={changePassword}>
          <fieldset disabled={!!busy}>
            <label>Senha atual<input name="current_password" type={showPasswords ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} value={passwords.current_password} onChange={event => updatePassword('current_password',event.target.value)}/></label>
            <label>Nova senha<input name="new_password" aria-label="Nova senha" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={passwords.new_password} onChange={event => updatePassword('new_password',event.target.value)} aria-describedby="profile-password-help"/><small id="profile-password-help">Use de 8 a 128 caracteres.</small></label>
            <label>Confirmar nova senha<input name="confirm_password" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={passwords.confirm_password} onChange={event => updatePassword('confirm_password',event.target.value)}/></label>
            <button type="button" className="text-button profile-show-passwords" aria-pressed={showPasswords} onClick={() => setShowPasswords(previous => !previous)}>{showPasswords ? <EyeOff size={15}/> : <Eye size={15}/>} {showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}</button>
          </fieldset>
          {passwordError && <div role="alert" className="error">{passwordError}</div>}
          {passwordSuccess && <p role="status" className="profile-success"><Check size={16}/>{passwordSuccess}</p>}
          <p className="profile-help">Ao alterar a senha, as outras sessões serão encerradas. Você continuará conectado(a) neste navegador.</p>
          <div className="profile-form-actions"><button className="primary" disabled={!!busy}><LockKeyhole size={16}/>{busy === 'password' ? 'Alterando…' : 'Alterar senha'}</button></div>
        </form>
      </section>
    </div>
  </div>;
}
