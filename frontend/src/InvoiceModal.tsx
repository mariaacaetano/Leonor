import {useEffect,useRef,useState} from 'react';
import {ArrowDownRight,Check,ChevronDown,ChevronLeft,ChevronRight,CreditCard,Pencil,Plus,Search,SlidersHorizontal,Tags,Trash2,Users,Wallet,X} from 'lucide-react';
import type {Entry} from './entries';
import CategoryChart from './CategoryChart';
import {emptyInvoiceFilters,filterInvoiceEntries,groupInvoiceCategories,groupInvoicePeople,hasReimbursement,invoiceSortOptions,invoiceSummary,signedAmount,sortInvoiceGroups,type Card,type CardPayment,type GroupSort,type InvoiceFilters,type InvoiceSort} from './invoice';

const money=(amount:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amount/100);
const date=(value:string)=>value?value.split('-').reverse().join('/'):'—';
type Props={
  card:Card,cards:Card[],month:string,entries:Entry[],payments:CardPayment[],active:boolean,loaded:boolean,error:string,
  onClose:()=>void,onCardChange:(id:number)=>void,onMonthChange:(month:string)=>void,onDismissError:()=>void,
  onEdit:(entry:Entry)=>Promise<void>,onPaid:(entry:Entry)=>Promise<void>,onReimbursement:(entry:Entry)=>Promise<void>,
  onAddPayment:()=>void,onEditPayment:(payment:CardPayment)=>void,onDeletePayment:(payment:CardPayment)=>Promise<void>,
};
type View='entries'|'categories'|'people'|'payments';
export default function InvoiceModal(props:Props){
  const {card,cards,month,entries,payments,active,loaded,error}=props;
  const dialog=useRef<HTMLDialogElement>(null);
  const [view,setView]=useState<View>('entries');
  const [filters,setFilters]=useState<InvoiceFilters>({...emptyInvoiceFilters});
  const [sort,setSort]=useState<InvoiceSort>('newest');
  const [showFilters,setShowFilters]=useState(false);
  const [groupSort,setGroupSort]=useState<GroupSort>('amount_desc');
  const [pending,setPending]=useState(false);
  const [paymentSearch,setPaymentSearch]=useState('');
  const [paymentSort,setPaymentSort]=useState('date_desc');
  useEffect(()=>{
    const element=dialog.current;
    if(!element||!active)return;
    element.showModal();
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{element.close();document.body.style.overflow=overflow;};
  },[active]);
  const summary=invoiceSummary(entries,payments,card.id);
  const visible=filterInvoiceEntries(summary.entries,filters,sort);
  const categoryGroups=sortInvoiceGroups(groupInvoiceCategories(visible),groupSort);
  const peopleGroups=sortInvoiceGroups(groupInvoicePeople(visible),groupSort);
  const categoryOptions=groupInvoiceCategories(summary.entries).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const peopleOptions=groupInvoicePeople(summary.entries).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const subtotal=visible.reduce((sum,e)=>sum+signedAmount(e),0);
  const outstanding=visible.filter(e=>hasReimbursement(e)&&!e.reimbursement_received).reduce((sum,e)=>sum+e.amount,0);
  const hasFilters=Object.values(filters).some(Boolean);
  const activeFilters=Object.entries(filters).filter(([key,value])=>key!=='search'&&value).length;
  const updateFilter=(key:keyof InvoiceFilters,value:string)=>setFilters(previous=>({...previous,[key]:value}));
  const clearFilters=()=>setFilters({...emptyInvoiceFilters});
  async function run(action:()=>Promise<void>){if(pending)return;setPending(true);try{await action();}finally{setPending(false);}}
  function moveMonth(amount:number){const next=new Date(month+'-15T12:00:00');next.setMonth(next.getMonth()+amount);props.onMonthChange(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`);}
  const visiblePayments=summary.payments.filter(p=>(p.description+' '+(p.payer_tag||'Eu mesmo(a)')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(paymentSearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())).sort((a,b)=>{
    if(paymentSort==='amount_desc')return b.amount-a.amount||b.id-a.id;
    if(paymentSort==='amount_asc')return a.amount-b.amount||b.id-a.id;
    return (paymentSort==='date_asc'?a.paid_on.localeCompare(b.paid_on):b.paid_on.localeCompare(a.paid_on))||b.id-a.id;
  });
  function entryRows(rows:Entry[]){return <div className="invoice-entry-list">{rows.map(e=><article className="invoice-entry" key={e.id}>
    <div className="invoice-entry-main"><div><strong>{e.description}</strong><small>{e.category} · Parcela {e.installment}/{e.installments}</small><small>Compra: {date(e.purchased_on)} · Vencimento: {date(e.due_date)}</small><div className="invoice-entry-tags">{e.payer_tag&&<span className="badge payer-tag"><Tags size={11}/>{e.payer_tag}</span>}{e.kind==='income'&&<span className="badge invoice-credit">Crédito / estorno</span>}{hasReimbursement(e)&&<span className={'badge '+(e.reimbursement_received?'invoice-received':'invoice-owed')}>{e.reimbursement_received?'Reembolso recebido':'A receber de '+e.reimbursement_person}</span>}</div></div><strong className={'invoice-entry-amount '+(e.kind==='income'?'invoice-credit':'')}>{e.kind==='income'?'− ':''}{money(e.amount)}</strong></div>
    <div className="invoice-entry-actions"><button disabled={pending} className={'status '+(e.paid?'paid':'')} aria-label={(e.paid?'Desmarcar pagamento: ':'Marcar como pago: ')+e.description} onClick={()=>void run(()=>props.onPaid(e))}>{e.paid?<><Check size={12}/> {e.kind==='income'?'Recebido':'Pago'}</>:'Pendente'}</button>{hasReimbursement(e)&&<button disabled={pending} className="text-button reimbursement-action" onClick={()=>void run(()=>props.onReimbursement(e))}>{e.reimbursement_received?'Desfazer recebimento':'Marcar reembolso recebido'}</button>}<button disabled={pending} className="icon-button" aria-label={'Editar '+e.description} title="Editar compra e suas parcelas" onClick={()=>void run(()=>props.onEdit(e))}><Pencil size={15}/></button></div>
  </article>)}</div>;}
  return <dialog ref={dialog} className="invoice-dialog" aria-labelledby="invoice-dialog-title" onCancel={event=>{event.preventDefault();props.onClose();}} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)props.onClose();}}}>
    <div className="invoice-dialog-header"><div className="invoice-heading-icon"><CreditCard size={23}/></div><div><span className="eyebrow">CADA COMPRA, NO SEU LUGAR</span><h2 id="invoice-dialog-title">Fatura · {card.name}</h2><p>Fechamento dia {card.closing_day} · Vencimento dia {card.due_day}</p></div><button autoFocus className="invoice-close" aria-label="Fechar fatura" onClick={props.onClose}><X size={21}/></button></div>
    <div className="invoice-context"><label>Cartão<select disabled={!loaded||pending} aria-label="Cartão da fatura" value={card.id} onChange={e=>props.onCardChange(Number(e.target.value))}>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div><span>Mês de vencimento</span><div className="month-picker"><button disabled={!loaded||pending} aria-label="Fatura do mês anterior" onClick={()=>moveMonth(-1)}><ChevronLeft size={16}/></button><input disabled={!loaded||pending} aria-label="Mês da fatura" type="month" value={month} onChange={e=>e.target.value&&props.onMonthChange(e.target.value)}/><button disabled={!loaded||pending} aria-label="Fatura do próximo mês" onClick={()=>moveMonth(1)}><ChevronRight size={16}/></button></div></div><button className="primary" disabled={!loaded||pending} onClick={props.onAddPayment}><Plus size={16}/> Registrar pagamento</button></div>
    {error&&<div className="error invoice-dialog-error" role="alert">{error}<button aria-label="Fechar erro da fatura" onClick={props.onDismissError}><X size={15}/></button></div>}
    {!loaded?<div className="empty">Carregando a fatura…</div>:<>
    <div className="invoice-metrics"><article className="invoice-metric-total"><span>Total da fatura</span><strong>{money(summary.total)}</strong><small>{summary.entries.length} parcelas e créditos</small></article><article><span>Restante a pagar</span><strong>{money(summary.remaining)}</strong><small>Considera os pagamentos da fatura</small></article><article><span>Pagamentos registrados</span><strong>{money(summary.paid)}</strong><small>{summary.payments.length} pagamento{summary.payments.length===1?'':'s'}</small></article><article><span>A receber de pessoas</span><strong>{money(summary.receivable)}</strong><small>{money(summary.received)} já recebidos</small></article></div>
    <div className="invoice-tabs" role="group" aria-label="Visões da fatura">{([['entries','Lançamentos',Wallet],['categories','Por categoria',Tags],['people','Por pessoa',Users],['payments','Pagamentos',ArrowDownRight]] as const).map(([id,label,Icon])=><button key={id} aria-pressed={view===id} className={view===id?'selected':''} onClick={()=>setView(id)}><Icon size={16}/>{label}</button>)}</div>
    {view!=='payments'?<>
      <div className="invoice-filter-area"><div className="invoice-filter-toolbar"><div className="invoice-search"><Search size={16}/><input aria-label="Buscar na fatura" placeholder="Buscar compra, categoria ou pessoa…" value={filters.search} onChange={e=>updateFilter('search',e.target.value)}/></div>
        {view==='entries'?<label className="invoice-main-sort">Ordenar compras<select aria-label="Ordenar compras da fatura" value={sort} onChange={e=>setSort(e.target.value as InvoiceSort)}>{Object.entries(invoiceSortOptions).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>:<label className="invoice-main-sort">Ordenar {view==='people'?'pessoas':'categorias'}<select aria-label="Ordenar grupos da fatura" value={groupSort} onChange={e=>setGroupSort(e.target.value as GroupSort)}><option value="amount_desc">Maior valor primeiro</option><option value="amount_asc">Menor valor primeiro</option><option value="name_asc">Nome: A a Z</option><option value="name_desc">Nome: Z a A</option></select></label>}
        <button className={'secondary filter-toggle'+(activeFilters?' has-filters':'')} aria-expanded={showFilters} aria-controls="invoice-extra-filters" onClick={()=>setShowFilters(previous=>!previous)}><SlidersHorizontal size={14}/> Filtros{activeFilters>0&&<span>{activeFilters}</span>}</button>
      </div>{showFilters&&<div className="invoice-filter-grid" id="invoice-extra-filters">
        <label>Categoria<select aria-label="Categoria na fatura" value={filters.category} onChange={e=>updateFilter('category',e.target.value)}><option value="">Todas as categorias</option>{categoryOptions.map(c=><option key={c.key} value={c.name}>{c.name}</option>)}</select></label>
        <label>Pessoa<select aria-label="Pessoa na fatura" value={filters.person} onChange={e=>updateFilter('person',e.target.value)}><option value="">Todas as pessoas</option><option value="self">Eu mesmo(a) / sem reembolso</option>{peopleOptions.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
        <label>Tipo<select aria-label="Tipo na fatura" value={filters.kind} onChange={e=>updateFilter('kind',e.target.value)}><option value="">Compras e créditos</option><option value="expense">Compras</option><option value="income">Créditos / estornos</option></select></label>
        <label>Pagamento<select aria-label="Status na fatura" value={filters.status} onChange={e=>updateFilter('status',e.target.value)}><option value="">Todos os status</option><option value="pending">Pendentes</option><option value="paid">Pagos / recebidos</option></select></label>
        <label>Reembolso<select aria-label="Reembolso na fatura" value={filters.reimbursement} onChange={e=>updateFilter('reimbursement',e.target.value)}><option value="">Todos</option><option value="pending">A receber</option><option value="received">Já recebido</option><option value="none">Sem reembolso</option></select></label>
        {view!=='entries'&&<label>Ordenar compras<select aria-label="Ordenar compras da fatura" value={sort} onChange={e=>setSort(e.target.value as InvoiceSort)}>{Object.entries(invoiceSortOptions).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}
      </div>}<div className="invoice-results-summary" role="status"><span>{view==='people'?`${peopleGroups.reduce((count,group)=>count+group.entries.length,0)} compras de outras pessoas · A receber nos resultados: ${money(outstanding)}`:`${visible.length} de ${summary.entries.length} lançamentos · Subtotal dos resultados: ${money(subtotal)}`}</span>{hasFilters&&<button className="text-button" onClick={clearFilters}>Limpar filtros da fatura</button>}</div></div>
      <div className="invoice-view-content">
        <p className="invoice-scope-note">Valores das parcelas desta fatura. Os filtros alteram os resultados abaixo; os totais no topo representam a fatura completa.</p>
        {view==='entries'&&entryRows(visible)}
        {view==='categories'&&<>{categoryGroups.length>0&&<CategoryChart groups={categoryGroups} allCategoryNames={categoryOptions.map(category=>category.name)} activeCategory={filters.category} onCategorySelect={name=>updateFilter('category',filters.category===name?'':name)}/>}<div className="invoice-groups">{categoryGroups.map(group=><details key={group.key} className="invoice-group" open={!!filters.category}><summary><span className="invoice-group-icon"><Tags size={17}/></span><span className="invoice-group-name"><strong>{group.name}</strong><small>{group.entries.length} lançamentos · Compras: {money(group.expenses)}{group.credits>0&&' · Créditos: '+money(group.credits)}</small></span><span className="invoice-group-total"><strong>{money(group.total)}</strong><small>Total da categoria</small></span><ChevronDown className="invoice-group-chevron" size={17}/></summary>{entryRows(group.entries)}</details>)}</div></>}
        {view==='people'&&<><p className="invoice-people-note"><Users size={16}/> O valor a receber considera apenas reembolsos pendentes, mesmo quando a compra já foi paga ao cartão.</p><div className="invoice-groups">{peopleGroups.map(group=><details key={group.key} className="invoice-group invoice-person-group" open={!!filters.person||peopleGroups.length===1}><summary><span className="invoice-person-avatar">{group.name[0]?.toUpperCase()}</span><span className="invoice-group-name"><strong>{group.name}</strong><small>{group.entries.length} compras · {money(group.received)} recebidos</small></span><span className="invoice-group-total"><strong>{money(group.total)}</strong><small>{group.total?'A receber':'Tudo recebido'}</small></span><ChevronDown className="invoice-group-chevron" size={17}/></summary>{entryRows(group.entries)}</details>)}</div></>}
        {((view==='entries'&&!visible.length)||(view==='categories'&&!categoryGroups.length)||(view==='people'&&!peopleGroups.length))&&<div className="empty"><Search/><h3>{hasFilters?'Nenhum resultado com esses filtros':view==='people'?'Nenhum reembolso nesta fatura':'Nenhum lançamento nesta fatura'}</h3><p>{hasFilters?'Ajuste a busca ou limpe os filtros para visualizar outros resultados.':view==='people'?'As compras com uma pessoa responsável aparecem aqui, com os valores a receber.':'Compras no crédito e estornos deste mês aparecerão aqui.'}</p>{hasFilters&&<button className="text-button" onClick={clearFilters}>Limpar filtros da fatura</button>}</div>}
      </div>
    </>:<div className="invoice-payments-content"><div className="invoice-payments-tools"><label>Buscar pagamento<input aria-label="Buscar pagamento da fatura" placeholder="Descrição ou pessoa…" value={paymentSearch} onChange={e=>setPaymentSearch(e.target.value)}/></label><label>Ordenar pagamentos<select aria-label="Ordenar pagamentos da fatura" value={paymentSort} onChange={e=>setPaymentSort(e.target.value)}><option value="date_desc">Data: mais recente</option><option value="date_asc">Data: mais antiga</option><option value="amount_desc">Maior valor primeiro</option><option value="amount_asc">Menor valor primeiro</option></select></label></div><p className="invoice-scope-note">{visiblePayments.length} pagamentos · Total dos resultados: {money(visiblePayments.reduce((sum,p)=>sum+p.amount,0))}</p>{visiblePayments.map(p=><article className="invoice-payment" key={p.id}><div><strong>{p.description}</strong><small>{date(p.paid_on)} · {p.payer_tag||'Eu mesmo(a)'}</small></div><strong>{money(p.amount)}</strong><button disabled={pending} className="icon-button" aria-label={'Editar pagamento parcial: '+p.description} onClick={()=>props.onEditPayment(p)}><Pencil size={15}/></button><button disabled={pending} className="icon-button" aria-label={'Excluir pagamento: '+p.description} onClick={()=>{if(confirm('Excluir este pagamento da fatura?'))void run(()=>props.onDeletePayment(p));}}><Trash2 size={15}/></button></article>)}{!visiblePayments.length&&<div className="empty"><Wallet/><h3>{paymentSearch?'Nenhum pagamento encontrado':'Nenhum pagamento registrado'}</h3><p>{paymentSearch?'Experimente outra descrição ou pessoa.':'Registre pagamentos para acompanhar o restante a pagar.'}</p>{paymentSearch&&<button className="text-button" onClick={()=>setPaymentSearch('')}>Limpar busca de pagamentos</button>}</div>}</div>}
    </>}
  </dialog>;
}
