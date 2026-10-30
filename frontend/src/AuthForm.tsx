import {useState, type FormEvent} from 'react';
import {ArrowUpRight} from 'lucide-react';
import LocationFields, {type LocationData} from './LocationFields';

type Props = {register:boolean, busy:boolean, error:string, onSubmit:(event:FormEvent<HTMLFormElement>)=>void, onToggle:()=>void};

export default function AuthForm({register, busy, error, onSubmit, onToggle}:Props) {
  const [location, setLocation] = useState<LocationData>({country:'Brasil', state:'', city:''});
  return <form onSubmit={onSubmit} className={'auth-form'+(register?' auth-register':'')}>
    <span className="eyebrow">BEM-VINDO À LEONOR</span>
    <h2>{register?'Vamos começar?':'Bom ter você por aqui.'}</h2>
    <p>{register?'Conte um pouco sobre você para criar sua conta.':'Entre para acompanhar sua vida financeira.'}</p>
    <fieldset disabled={busy}>
      {register&&<label>Nome completo<input name="full_name" autoComplete="name" required minLength={3} maxLength={120} placeholder="Seu nome e sobrenome"/></label>}
      <label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="voce@exemplo.com"/></label>
      {register&&<><label>Telefone<input name="phone" type="tel" autoComplete="tel" required maxLength={30} placeholder="(11) 99999-9999" aria-describedby="registration-phone-help"/></label><small className="auth-field-help" id="registration-phone-help">Inclua o DDD. Para números de outros países, inclua o código do país.</small></>}
      <label>Senha<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={register?'new-password':'current-password'} placeholder="Pelo menos 8 caracteres"/></label>
      {register&&<fieldset className="registration-location"><legend>Onde você mora? <span>(opcional)</span></legend><p>Informe sua cidade e região. Não precisamos do endereço completo.</p><LocationFields value={location} onChange={setLocation}/></fieldset>}
    </fieldset>
    {error&&<div role="alert" className="error">{error}</div>}
    <button className="primary" disabled={busy}>{busy?'Aguarde…':register?'Criar minha conta':'Entrar na minha conta'}<ArrowUpRight size={18}/></button>
    <button type="button" disabled={busy} className="text-button" onClick={onToggle}>{register?'Já tenho uma conta':'Ainda não tem conta? Cadastre-se'}</button>
    <small>Seus registros ficam vinculados exclusivamente à sua conta.</small>
  </form>;
}
