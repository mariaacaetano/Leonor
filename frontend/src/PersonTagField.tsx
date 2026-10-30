import {useEffect, useId, useRef, useState} from 'react';
import {Check, Plus, X} from 'lucide-react';

type PersonTag = {id:number, name:string};
type Props = {
  tags:PersonTag[];
  initialTagId:number|null;
  disabled:boolean;
  onCreate:(name:string)=>Promise<PersonTag>;
};

export default function PersonTagField({tags, initialTagId, disabled, onCreate}:Props) {
  const id = useId();
  const select = useRef<HTMLSelectElement>(null);
  const restoreFocus = useRef(false);
  const [value, setValue] = useState(initialTagId === null ? '' : String(initialTagId));
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (restoreFocus.current && !expanded && !disabled && !saving) {
      restoreFocus.current = false;
      select.current?.focus();
    }
  }, [expanded, disabled, saving]);
  async function create() {
    if (disabled || saving) return;
    const trimmed = name.trim();
    if (!trimmed) {setError('Informe o nome da pessoa.'); return;}
    setSaving(true); setError('');
    try {
      const tag = await onCreate(trimmed);
      restoreFocus.current = true;
      setValue(String(tag.id)); setExpanded(false); setName('');
    } catch (error) {setError((error as Error).message);}
    finally {setSaving(false);}
  }
  function cancel() {
    restoreFocus.current = true;
    setExpanded(false); setName(''); setError('');
  }
  return <div className="person-tag-field">
    <label htmlFor={id}>Quem paga? (opcional)</label>
    <select ref={select} id={id} name="payer_tag_id" value={value} disabled={disabled || saving} onChange={event => setValue(event.target.value)}>
      <option value="">Eu mesmo(a)</option>
      {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
    </select>
    {expanded ? <div className="person-tag-create" id={id+'-create'}>
      <label htmlFor={id+'-name'}>Nome da pessoa</label>
      <input id={id+'-name'} type="text" autoFocus maxLength={80} value={name} disabled={disabled || saving}
        aria-invalid={!!error} aria-describedby={error ? id+'-error' : undefined}
        onChange={event => {setName(event.target.value); setError('');}}
        onKeyDown={event => {if (event.key === 'Enter' && !event.nativeEvent.isComposing) {event.preventDefault(); void create();}}}
        placeholder="Ex.: Ana"/>
      <div className="person-tag-create-actions">
        <button type="button" className="secondary" disabled={disabled || saving} onClick={cancel}><X size={14}/>Cancelar</button>
        <button type="button" className="primary" disabled={disabled || saving || !name.trim()} onClick={() => void create()}><Check size={14}/>{saving ? 'Criando…' : 'Adicionar pessoa'}</button>
      </div>
      {error && <div className="error" id={id+'-error'} role="alert">{error}</div>}
    </div> : <button type="button" className="text-button person-tag-add" aria-expanded={false} aria-controls={id+'-create'} disabled={disabled} onClick={() => setExpanded(true)}><Plus size={14}/>Adicionar pessoa</button>}
  </div>;
}
