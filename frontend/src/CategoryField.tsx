import {useEffect, useId, useRef, useState} from 'react';
import {Check, Plus, X} from 'lucide-react';

type Category = {id:number, name:string};
type Props = {
  categories:Category[];
  initialCategoryId?:number;
  disabled:boolean;
  onCreate:(name:string)=>Promise<Category>;
};

export default function CategoryField({categories, initialCategoryId, disabled, onCreate}:Props) {
  const id = useId();
  const select = useRef<HTMLSelectElement>(null);
  const restoreFocus = useRef(false);
  const [value, setValue] = useState(String(initialCategoryId ?? categories[0]?.id ?? ''));
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
    if (!trimmed) {setError('Informe o nome da categoria.'); return;}
    setSaving(true); setError('');
    try {
      const category = await onCreate(trimmed);
      restoreFocus.current = true;
      setValue(String(category.id)); setExpanded(false); setName('');
    } catch (error) {setError((error as Error).message);}
    finally {setSaving(false);}
  }
  function cancel() {
    restoreFocus.current = true;
    setExpanded(false); setName(''); setError('');
  }
  return <div className="category-field">
    <label htmlFor={id}>Categoria</label>
    <select ref={select} id={id} name="category_id" required value={value} disabled={disabled || saving} onChange={event=>setValue(event.target.value)}>
      {!categories.length&&<option value="">Adicione uma categoria</option>}
      {categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
    </select>
    {expanded ? <div className="category-create" id={id+'-create'}>
      <label htmlFor={id+'-name'}>Nome da nova categoria</label>
      <input id={id+'-name'} type="text" autoFocus maxLength={80} value={name} disabled={disabled || saving}
        aria-invalid={!!error} aria-describedby={error?id+'-error':undefined}
        onChange={event=>{setName(event.target.value);setError('');}}
        onKeyDown={event=>{if(event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();void create();}}}
        placeholder="Ex.: Assinaturas"/>
      <div className="category-create-actions">
        <button type="button" className="secondary" disabled={disabled || saving} onClick={cancel}><X size={14}/>Cancelar</button>
        <button type="button" className="primary" disabled={disabled || saving || !name.trim()} onClick={()=>void create()}><Check size={14}/>{saving?'Criando…':'Criar categoria'}</button>
      </div>
      {error&&<div className="error" id={id+'-error'} role="alert">{error}</div>}
    </div> : <button type="button" className="text-button category-add" aria-expanded={false} aria-controls={id+'-create'} disabled={disabled} onClick={()=>setExpanded(true)}><Plus size={14}/>Adicionar categoria</button>}
  </div>;
}
