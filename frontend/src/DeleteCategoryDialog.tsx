import {useEffect,useRef,useState} from 'react';
import {Tags,Trash2,X} from 'lucide-react';
type Category={id:number,name:string};
type Usage={transaction_count:number};
type Props={category:Category,categories:Category[],loadUsage:(id:number)=>Promise<Usage>,onDelete:(replacementId:number|null)=>Promise<void>,onClose:()=>void};
export default function DeleteCategoryDialog({category,categories,loadUsage,onDelete,onClose}:Props){
  const dialog=useRef<HTMLDialogElement>(null);
  const [usage,setUsage]=useState<Usage|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [replacement,setReplacement]=useState('');
  const [retry,setRetry]=useState(0);
  const alternatives=categories.filter(c=>c.id!==category.id);
  const needsReplacement=!!usage?.transaction_count;
  useEffect(()=>{
    const element=dialog.current;
    if(!element)return;
    element.showModal();
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{element.close();document.body.style.overflow=overflow;};
  },[]);
  useEffect(()=>{
    let disposed=false;
    setLoading(true);
    loadUsage(category.id).then(result=>{if(!disposed){setUsage(result);setError('');}}).catch(error=>{if(!disposed)setError((error as Error).message);}).finally(()=>{if(!disposed)setLoading(false);});
    return ()=>{disposed=true;};
  },[category.id,loadUsage,retry]);
  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(busy||loading||!usage||(needsReplacement&&!replacement))return;
    setBusy(true);setError('');
    try{await onDelete(needsReplacement?Number(replacement):null);}
    catch(error){
      setError((error as Error).message);
      // A purchase may have started using this category since the dialog opened.
      try{setUsage(await loadUsage(category.id));}catch{}
    }finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="category-delete-dialog" aria-labelledby="delete-category-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <form onSubmit={submit}>
      <div className="category-delete-header"><span className="category-delete-icon"><Trash2 size={21}/></span><div><h2 id="delete-category-title">Excluir categoria</h2><p>{category.name}</p></div><button type="button" aria-label="Fechar exclusão de categoria" disabled={busy} onClick={onClose}><X size={20}/></button></div>
      {loading?<p role="status">Verificando os lançamentos desta categoria…</p>:usage?<>
        {needsReplacement?<><div className="category-delete-note"><Tags size={18}/><p>Esta categoria é usada em <strong>{usage.transaction_count} lançamento{usage.transaction_count===1?'':'s'}</strong>, considerando todos os meses. Escolha para qual categoria eles devem ir.</p></div>{alternatives.length?<label>Transferir lançamentos para<select autoFocus required aria-label="Transferir lançamentos para" value={replacement} onChange={e=>setReplacement(e.target.value)} disabled={busy}><option value="">Selecione outra categoria</option>{alternatives.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>:<p>Crie outra categoria antes de excluir esta, para receber os lançamentos existentes.</p>}<p className="category-delete-help">As compras, parcelas, pagamentos e reembolsos serão preservados. Apenas a categoria será alterada.</p></>:<p>Excluir a categoria <strong>{category.name}</strong>? Ela não possui lançamentos vinculados.</p>}
      </>:null}
      {error&&<div className="error" role="alert">{error}</div>}
      {!loading&&!usage&&<button type="button" className="text-button" onClick={()=>setRetry(previous=>previous+1)}>Tentar novamente</button>}
      <div className="category-delete-actions"><button type="button" className="secondary" autoFocus disabled={busy} onClick={onClose}>Cancelar</button><button className="danger-button" type="submit" disabled={loading||busy||!usage||(needsReplacement&&!replacement)}><Trash2 size={15}/>{busy?'Excluindo…':needsReplacement?'Transferir e excluir':'Excluir categoria'}</button></div>
    </form>
  </dialog>;
}
