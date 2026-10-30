import {useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {Building2, Plus, Pencil, Trash2, X, Check, ReceiptText, ArrowDownRight, ArrowUpRight, Wallet, ChevronDown} from 'lucide-react';
import {amountCents, companyMoney as money, unitMoney, itemTotal, itemUnitCost, filterCompanyRecords, recordMonthAmount,
  type Company, type CompanyRecord, type CompanyLedger, type DraftItem} from './company-ledger';
import './companies.css';
import type {AccountRoute} from './routes';

type Api = (path:string, method?:string, body?:unknown) => Promise<any>;
type Editor = {type:'company', company?:Company} | {type:'record', kind:'expense'|'income', record?:CompanyRecord};
const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateLabel = (value:string) => value.split('-').reverse().join('/');
const blankItem = ():DraftItem => ({description:'', quantity:'1', amount:''});

function CompanyDialog({title, busy, onClose, children}:{title:string, busy:boolean, onClose:()=>void, children:ReactNode}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {element.close(); document.body.style.overflow = overflow;};
  }, []);
  return <dialog ref={ref} className="company-dialog" aria-labelledby="company-dialog-title"
    onCancel={event => {event.preventDefault(); if (!busy) onClose();}}>
    <div className="company-dialog-heading"><h2 id="company-dialog-title">{title}</h2><button type="button" aria-label="Fechar formulário" disabled={busy} onClick={onClose}><X size={21}/></button></div>
    {children}
  </dialog>;
}

function CompanyForm({company, api, onSaved, onClose}:{company?:Company, api:Api, onSaved:(company:Company)=>void, onClose:()=>void}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const name = String(new FormData(event.currentTarget).get('name') || '').trim();
    if (!name) {setError('Informe o nome da empresa.'); return;}
    setBusy(true); setError('');
    try {onSaved(await api('/companies' + (company ? '/' + company.id : ''), company ? 'PATCH' : 'POST', {name}));}
    catch (error) {setError((error as Error).message); setBusy(false);}
  }
  return <CompanyDialog title={company ? 'Editar empresa' : 'Nova empresa'} busy={busy} onClose={onClose}>
    <form onSubmit={submit}>
      <fieldset disabled={busy}><label>Nome da empresa<input name="name" autoFocus required maxLength={120} defaultValue={company?.name} placeholder="Ex.: Minha loja"/></label></fieldset>
      {error && <div role="alert" className="error">{error}</div>}
      <div className="company-form-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}><Check size={16}/>{busy ? 'Salvando…' : 'Salvar empresa'}</button></div>
    </form>
  </CompanyDialog>;
}

function RecordForm({company, kind, record, api, onSaved, onClose}:{company:Company, kind:'expense'|'income', record?:CompanyRecord, api:Api, onSaved:()=>void, onClose:()=>void}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [withItems, setWithItems] = useState(!!record?.items.length);
  const [items, setItems] = useState<DraftItem[]>(record?.items.length ? record.items.map(item => ({description:item.description, quantity:item.quantity, amount:(item.amount/100).toFixed(2)})) : [blankItem()]);
  const [amount, setAmount] = useState(record ? (record.amount/100).toFixed(2) : '');
  const [installments, setInstallments] = useState(String(record?.installments || 1));
  const expense = kind === 'expense';
  const total = expense && withItems ? itemTotal(items) : amountCents(amount);
  function changeItem(index:number, key:keyof DraftItem, value:string) {
    setItems(previous => previous.map((item, i) => i === index ? {...item, [key]:value} : item));
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    if (!String(form.get('description')).trim()) {setError('Informe a descrição do registro.'); return;}
    if (total <= 0 || total > 10000000000) {setError('Informe um valor total entre R$ 0,01 e R$ 100.000.000,00.'); return;}
    if (withItems && items.some(item => !item.description.trim() || Number(item.quantity) <= 0 || amountCents(item.amount) <= 0)) {
      setError('Preencha a descrição, a quantidade e o valor total de cada item.'); return;
    }
    setBusy(true); setError('');
    try {
      await api(`/companies/${company.id}/records` + (record ? '/' + record.id : ''), record ? 'PUT' : 'POST', {
        kind, description:String(form.get('description')).trim(), location:expense ? form.get('location') : '',
        occurred_on:form.get('occurred_on'), amount:(total/100).toFixed(2), installments:expense ? Number(installments) : 1,
        items:expense && withItems ? items.map(item => ({...item, description:item.description.trim()})) : []
      });
      onSaved();
    } catch (error) {setError((error as Error).message); setBusy(false);}
  }
  return <CompanyDialog title={(record ? 'Editar ' : 'Nova ') + (expense ? 'despesa / nota' : 'venda')} busy={busy} onClose={onClose}>
    <p className="company-form-context">{company.name}</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        <label>Descrição geral<input name="description" autoFocus required maxLength={200} defaultValue={record?.description} placeholder={expense ? 'Ex.: Compra de materiais' : 'Ex.: Vendas da semana'}/></label>
        <div className="form-grid">
          {expense && <label>Local / fornecedor<input name="location" required maxLength={200} defaultValue={record?.location} placeholder="Ex.: Loja de materiais"/></label>}
          <label>{expense ? 'Data da compra' : 'Data da entrada'}<input type="date" name="occurred_on" required defaultValue={record?.occurred_on || today()}/></label>
          {expense && <label>Quantidade de parcelas<input type="number" min="1" max="120" step="1" required value={installments} onChange={event => setInstallments(event.target.value)}/></label>}
          {(!expense || !withItems) && <label>Valor total (R$)<input type="number" min="0.01" max="100000000" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00"/></label>}
        </div>
        {expense && <>
          <label className="company-items-toggle"><input type="checkbox" checked={withItems} onChange={event => setWithItems(event.target.checked)}/>Detalhar os itens da nota</label>
          {withItems && <section className="company-note-items" aria-label="Itens da nota">
            <div className="company-note-heading"><h3>Itens da nota</h3><small>Informe o valor total de cada item, incluindo todas as peças.</small></div>
            {items.map((item, index) => <div className="company-item-fields" key={index}>
              <label className="company-item-description">Descrição do item {index+1}<input required maxLength={200} value={item.description} onChange={event => changeItem(index, 'description', event.target.value)} placeholder="Ex.: Camisetas"/></label>
              <label>Quantidade<input type="number" min="0.001" max="100000000" step="0.001" required value={item.quantity} onChange={event => changeItem(index, 'quantity', event.target.value)}/></label>
              <label>Valor total (R$)<input type="number" min="0.01" max="100000000" step="0.01" required value={item.amount} onChange={event => changeItem(index, 'amount', event.target.value)} placeholder="0,00"/></label>
              <div className="company-unit-cost"><span>Custo por peça</span><output aria-label={'Custo por peça do item '+(index+1)}>{unitMoney(itemUnitCost(item))}</output></div>
              <button type="button" className="icon-button" disabled={items.length === 1} aria-label={'Remover item '+(index+1)} onClick={() => setItems(previous => previous.filter((_,i) => i !== index))}><Trash2 size={17}/></button>
            </div>)}
            <button type="button" className="text-button" disabled={items.length >= 200} onClick={() => setItems(previous => [...previous, blankItem()])}><Plus size={15}/>Adicionar item</button>
          </section>}
        </>}
      </fieldset>
      <div className="company-note-total"><span>{expense && withItems ? 'Total da nota' : expense ? 'Total da despesa' : 'Total da venda'}</span><strong>{money(total)}</strong></div>
      {expense && <p className="form-note">A primeira parcela fica na data da compra, e as seguintes no mesmo dia dos próximos meses. O balanço mensal considera as parcelas do mês; o acumulado considera o valor total das compras e vendas.</p>}
      {error && <div className="error" role="alert">{error}</div>}
      <div className="company-form-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}><Check size={16}/>{busy ? 'Salvando…' : 'Salvar registro'}</button></div>
    </form>
  </CompanyDialog>;
}

function RecordDetails({record, month, scope, busy, onEdit, onDelete}:{record:CompanyRecord, month:string, scope:string, busy:boolean, onEdit:()=>void, onDelete:()=>void}) {
  const installment = record.schedule.find(entry => entry.due_date.slice(0,7) === month);
  return <article className="company-record">
    <details>
      <summary>
        <span className={'company-record-icon '+record.kind}>{record.kind === 'expense' ? <ReceiptText size={20}/> : <ArrowDownRight size={20}/>}</span>
        <span className="company-record-description"><strong>{record.description}</strong><small>{record.kind === 'income' ? 'Venda' : record.items.length ? 'Nota' : 'Despesa'} · {dateLabel(record.occurred_on)}{record.location && ' · '+record.location}</small></span>
        <span className={'company-record-amount amount '+record.kind}><strong>{money(scope === 'month' ? recordMonthAmount(record, month) : record.amount)}</strong><small>{scope === 'month' && record.installments > 1 && installment ? `Parcela ${installment.number}/${record.installments} · total ${money(record.amount)}` : record.installments > 1 ? `${record.installments} parcelas` : 'À vista'}</small></span>
        <ChevronDown size={17} className="company-record-chevron"/>
      </summary>
      <div className="company-record-details">
        {record.items.length > 0 && <div className="table-wrap"><table><caption>Itens da nota</caption><thead><tr><th>Descrição</th><th>Quantidade</th><th className="right">Valor total</th><th className="right">Custo por peça</th></tr></thead><tbody>{record.items.map((item, index) => <tr key={index}><td>{item.description}</td><td>{Number(item.quantity).toLocaleString('pt-BR', {maximumFractionDigits:3})}</td><td className="right">{money(item.amount)}</td><td className="right">{unitMoney(Number(item.unit_cost))}</td></tr>)}</tbody></table></div>}
        <div className="company-schedule"><h3>{record.kind === 'income' ? 'Entrada registrada' : 'Parcelamento'}</h3><ul>{record.schedule.map(entry => <li key={entry.number} className={entry.due_date.slice(0,7) === month ? 'current' : ''}><span>{record.installments > 1 ? `${entry.number}/${record.installments} · ` : ''}{dateLabel(entry.due_date)}</span><strong>{money(entry.amount)}</strong></li>)}</ul></div>
      </div>
    </details>
    <div className="company-record-actions"><button className="icon-button" disabled={busy} aria-label={'Editar '+record.description} title="Editar registro" onClick={onEdit}><Pencil size={16}/></button><button className="icon-button" disabled={busy} aria-label={'Excluir '+record.description} title="Excluir registro" onClick={onDelete}><Trash2 size={16}/></button></div>
  </article>;
}

export default function Companies({api, month, route, onNavigate}:{api:Api, month:string, route:AccountRoute, onNavigate:(path:string,replace?:boolean)=>void}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const selectedId=route.companyId??companies[0]?.id??null;
  const setSelectedId=(id:number|null)=>onNavigate(id?`/conta/empresas/${id}`:'/conta/empresas');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [ledger, setLedger] = useState<CompanyLedger|null>(null), [retry, setRetry] = useState(0), [listRetry, setListRetry] = useState(0);
  const [scope, setScope] = useState('month'), [search, setSearch] = useState('');
  const selected = companies.find(company => company.id === selectedId);
  const currentLedger = ledger?.company.id === selectedId && ledger?.month === month ? ledger : null;
  const selectedRecord=currentLedger?.records.find(record=>record.id===route.recordId);
  const editor:Editor|null=route.companyAction==='add'?{type:'company'}:route.companyAction==='edit'&&selected?{type:'company',company:selected}:route.companyAction==='expense'||route.companyAction==='income'?{type:'record',kind:route.companyAction==='expense'?'expense':'income'}:route.companyAction==='record'&&selectedRecord?{type:'record',kind:selectedRecord.kind,record:selectedRecord}:null;
  function setEditor(next:Editor|null){
    if(!next){onNavigate(route.parent,true);return;}
    if(next.type==='company')onNavigate(next.company?`/conta/empresas/${next.company.id}/editar`:'/conta/empresas/adicionar');
    else if(selectedId)onNavigate(next.record?`/conta/empresas/${selectedId}/registros/${next.record.id}/editar`:`/conta/empresas/${selectedId}/${next.kind==='expense'?'despesas':'vendas'}/adicionar`);
  }

  useEffect(() => {
    let disposed = false;
    setLoading(true); setError('');
    api('/companies').then((result:Company[]) => {if (!disposed) {setCompanies(result);}})
      .catch(error => {if (!disposed) setError((error as Error).message);})
      .finally(() => {if (!disposed) setLoading(false);});
    return () => {disposed = true;};
  }, [listRetry]);
  useEffect(() => {
    let disposed = false;
    setLedger(null); setError('');
    if (selectedId !== null) api(`/companies/${selectedId}/ledger?month=${month}`)
      .then((result:CompanyLedger) => {if (!disposed) setLedger(result);})
      .catch(error => {if (!disposed) setError((error as Error).message);});
    return () => {disposed = true;};
  }, [selectedId, month, retry]);
  function savedCompany(company:Company) {
    setCompanies(previous => [...previous.filter(item => item.id !== company.id), company].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')));
    setRetry(previous => previous+1); setError('');onNavigate(`/conta/empresas/${company.id}`,true);
  }
  async function removeCompany() {
    if (!selected || busy || !confirm(`Excluir a empresa “${selected.name}”? Apenas empresas sem registros podem ser excluídas.`)) return;
    setBusy(true); setError('');
    try {
      await api('/companies/'+selected.id, 'DELETE');
      const remaining = companies.filter(company => company.id !== selected.id);
      setCompanies(remaining); setSelectedId(remaining[0]?.id ?? null);
    } catch (error) {setError((error as Error).message);} finally {setBusy(false);}
  }
  async function removeRecord(record:CompanyRecord) {
    if (!selected || busy || !confirm(`Excluir “${record.description}” e todas as suas parcelas? O balanço será recalculado.`)) return;
    setBusy(true); setError('');
    try {await api(`/companies/${selected.id}/records/${record.id}`, 'DELETE'); setRetry(previous => previous+1);}
    catch (error) {setError((error as Error).message);} finally {setBusy(false);}
  }
  const visible = currentLedger ? filterCompanyRecords(currentLedger.records, month, scope, search) : [];
  return <div className="companies-view">
    <div className="section-heading company-topline"><p>Cadastre empresas e acompanhe suas compras e vendas.</p><button className="primary" disabled={busy || loading} onClick={() => setEditor({type:'company'})}><Plus size={16}/>Nova empresa</button></div>
    {!loading&&route.companyId&&!selected&&<div className="error" role="alert">Empresa não encontrada.</div>}
    {currentLedger&&route.recordId&&!selectedRecord&&<div className="error" role="alert">Registro não encontrado nesta empresa.</div>}
    {error && <div className="error" role="alert">{error}<button className="text-button" onClick={() => {setListRetry(previous => previous+1); setRetry(previous => previous+1);}}>Tentar novamente</button></div>}
    {loading ? <div className="panel empty" role="status">Carregando empresas…</div> : companies.length === 0 ? <div className="panel empty"><Building2/><h3>Um espaço para suas empresas</h3><p>Cadastre a primeira empresa para registrar notas, despesas e vendas.</p><button className="text-button" onClick={() => setEditor({type:'company'})}><Plus size={15}/>Cadastrar empresa</button></div> : <>
      <div className="company-selector-row"><label>Empresa<select aria-label="Empresa" value={selectedId ?? ''} disabled={busy} onChange={event => {setSelectedId(Number(event.target.value)); setSearch('');}}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><button className="secondary" disabled={busy} onClick={() => setEditor({type:'company', company:selected})}><Pencil size={15}/>Editar empresa</button><button className="icon-button" disabled={busy} aria-label="Excluir empresa selecionada" onClick={() => void removeCompany()}><Trash2 size={17}/></button></div>
      {!currentLedger ? !error && selected && <div className="panel empty" role="status">Carregando balanço da empresa…</div> : <>
        <section className="stats company-stats" aria-label="Balanço da empresa">
          {[
            {label:'Balanço do mês', value:currentLedger.monthly.balance, type:'balance', note:'Vendas menos parcelas de despesas', icon:Wallet},
            {label:'Vendas do mês', value:currentLedger.monthly.income, type:'income', note:'Entradas na data registrada', icon:ArrowDownRight},
            {label:'Gastos do mês', value:currentLedger.monthly.expenses, type:'expense', note:'Inclui somente as parcelas deste mês', icon:ArrowUpRight},
            {label:'Balanço acumulado', value:currentLedger.total.balance, type:'total', note:'Total de vendas menos total de gastos', icon:Building2}
          ].map(stat => <article key={stat.type} className={'stat '+stat.type}><div>{stat.label}<span><stat.icon size={19}/></span></div><strong>{money(stat.value)}</strong><small>{stat.note}</small></article>)}
        </section>
        <div className="company-total-context"><span>Todo o histórico de <strong>{selected?.name}</strong></span><span>Vendas: <strong>{money(currentLedger.total.income)}</strong></span><span>Gastos: <strong>{money(currentLedger.total.expenses)}</strong></span></div>
        <section className="panel company-registers" aria-label="Registros da empresa">
          <div className="panel-title"><div><h2>Notas, despesas e vendas</h2><p>Abra um registro para ver os itens e as parcelas.</p></div><div className="company-add-actions"><button className="secondary" disabled={busy} onClick={() => setEditor({type:'record', kind:'expense'})}><Plus size={15}/>Nova despesa / nota</button><button className="primary" disabled={busy} onClick={() => setEditor({type:'record', kind:'income'})}><Plus size={15}/>Nova venda</button></div></div>
          <div className="company-list-tools"><div className="segmented"><button className={scope === 'month' ? 'selected' : ''} aria-pressed={scope === 'month'} onClick={() => setScope('month')}>Mês selecionado</button><button className={scope === 'all' ? 'selected' : ''} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Todo o histórico</button></div><input className="search" aria-label="Buscar registros da empresa" placeholder="Buscar descrição, local ou item…" value={search} onChange={event => setSearch(event.target.value)}/></div>
          <p className="company-list-caption" role="status">{visible.length} registro{visible.length === 1 ? '' : 's'} · {scope === 'month' ? 'Valores das parcelas do mês selecionado' : 'Valores totais das compras e vendas'}</p>
          {visible.map(record => <RecordDetails key={record.id} record={record} month={month} scope={scope} busy={busy} onEdit={() => setEditor({type:'record', kind:record.kind, record})} onDelete={() => void removeRecord(record)}/>)}
          {!visible.length && <div className="empty"><ReceiptText/><h3>{search ? 'Nenhum registro encontrado' : scope === 'month' ? 'Nenhum movimento neste mês' : 'Comece pelos primeiros registros'}</h3><p>{search ? 'Ajuste a busca para encontrar outros registros.' : 'Adicione uma despesa, uma nota com itens ou uma venda para acompanhar o balanço.'}</p>{scope === 'month' && currentLedger.records.length > 0 && <button className="text-button" onClick={() => {setScope('all'); setSearch('');}}>Ver todo o histórico</button>}</div>}
        </section>
      </>}
    </>}
    {editor?.type === 'company' && <CompanyForm key={route.companyAction+'-'+(route.companyId??'new')} company={editor.company} api={api} onSaved={savedCompany} onClose={() => setEditor(null)}/>}
    {editor?.type === 'record' && selected && <RecordForm key={route.companyAction+'-'+(route.recordId??'new')+'-'+selected.id} company={selected} kind={editor.kind} record={editor.record} api={api} onSaved={() => {setEditor(null); setRetry(previous => previous+1);}} onClose={() => setEditor(null)}/>}
  </div>;
}
