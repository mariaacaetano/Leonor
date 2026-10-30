import {Info, ArrowDownRight, ArrowUpRight, Building2, ChevronRight, Wallet} from 'lucide-react';
import type {Entry} from './entries';
import {companyMoney as money} from './company-ledger';
import './overview.css';

export type CompanySummary = {id:number, name:string, income:number, expenses:number, balance:number};
type Props = {
  personal:{income:number, expenses:number, balance:number, pending:number, entries:Entry[]};
  companies:CompanySummary[];
  onPersonal:()=>void;
  onCompanies:(id?:number)=>void;
};

export default function Overview({personal, companies, onPersonal, onCompanies}:Props) {
  const business = companies.reduce((total, company) => ({
    income:total.income+company.income, expenses:total.expenses+company.expenses, balance:total.balance+company.balance
  }), {income:0, expenses:0, balance:0});
  const categories = Object.entries(personal.entries.filter(entry => entry.kind === 'expense').reduce((totals:Record<string,number>, entry) => {
    totals[entry.category] = (totals[entry.category] || 0) + entry.amount;
    return totals;
  }, {})).sort((a,b) => b[1]-a[1]).slice(0,3);
  const highlighted = [...companies].sort((a,b) => (b.income+b.expenses)-(a.income+a.expenses) || a.name.localeCompare(b.name,'pt-BR')).slice(0,3);
  return <div className="overview-summary">
    <section className="stats overview-totals" aria-label="Resumo de pessoal e empresas">
      {[
        {label:'Saldo previsto · pessoal + empresas', value:personal.balance+business.balance, type:'balance', personal:personal.balance, business:business.balance, icon:Wallet},
        {label:'Entradas do mês', value:personal.income+business.income, type:'income', personal:personal.income, business:business.income, icon:ArrowDownRight},
        {label:'Gastos do mês', value:personal.expenses+business.expenses, type:'expense', personal:personal.expenses, business:business.expenses, icon:ArrowUpRight}
      ].map(stat => <article key={stat.type} className={'stat '+stat.type}>
        <div>{stat.label}<span><stat.icon size={19}/></span></div>
        <strong>{money(stat.value)}</strong>
        <div className="stat-breakdown"><small><span>Pessoal</span><b>{money(stat.personal)}</b></small><small><span>Empresas</span><b>{money(stat.business)}</b></small></div>
      </article>)}
    </section>
    <div className="overview-explainer"><Info size={18} aria-hidden="true"/><p><strong>Como ler seu saldo?</strong> É a diferença entre as entradas e os gastos registrados no mês. Inclui valores que ainda serão pagos ou recebidos.</p></div>
    <div className="overview-panels">
      <section className="panel overview-panel" aria-labelledby="overview-personal-title">
        <div className="panel-title"><div className="overview-panel-heading"><span className="overview-icon"><Wallet size={20}/></span><div><h2 id="overview-personal-title">Sua vida pessoal</h2><p>Sua vida financeira, no seu ritmo</p></div></div><button className="text-button" onClick={onPersonal}>Ver lançamentos<ChevronRight size={15}/></button></div>
        <dl className="overview-metrics">
          <div><dt>Entradas</dt><dd className="income">{money(personal.income)}</dd></div>
          <div><dt>Gastos</dt><dd className="expense">{money(personal.expenses)}</dd></div>
          <div><dt>Saldo previsto</dt><dd>{money(personal.balance)}</dd></div>
          <div><dt>Ainda a pagar</dt><dd>{money(personal.pending)}</dd></div>
        </dl>
        <div className="overview-details"><h3>Maiores gastos por categoria</h3>
          {categories.length ? <ul className="overview-categories">{categories.map(([name,amount],index) => <li key={name}><div><span><i style={{background:['#173F35','#B9CBB9','#E7B29B'][index]}}/>{name}</span><strong>{money(amount)}</strong></div><div className="bar"><div style={{width:`${personal.expenses > 0 ? amount/personal.expenses*100 : 0}%`,background:['#173F35','#B9CBB9','#E7B29B'][index]}}/></div></li>)}</ul>
            : <p className="overview-empty">Seus gastos aparecerão aqui ao adicionar lançamentos.</p>}
        </div>
      </section>
      <section className="panel overview-panel" aria-labelledby="overview-companies-title">
        <div className="panel-title"><div className="overview-panel-heading"><span className="overview-icon"><Building2 size={20}/></span><div><h2 id="overview-companies-title">Seus negócios</h2><p>{companies.length} empresa{companies.length === 1 ? '' : 's'} cadastrada{companies.length === 1 ? '' : 's'}</p></div></div><button className="text-button" onClick={() => onCompanies()}>Ver empresas<ChevronRight size={15}/></button></div>
        <dl className="overview-metrics business">
          <div><dt>Vendas</dt><dd className="income">{money(business.income)}</dd></div>
          <div><dt>Gastos</dt><dd className="expense">{money(business.expenses)}</dd></div>
          <div><dt>Saldo previsto</dt><dd>{money(business.balance)}</dd></div>
        </dl>
        <div className="overview-details"><h3>Resumo por empresa</h3>
          {highlighted.length ? <><ul className="overview-company-list">{highlighted.map(company => <li key={company.id}><button aria-label={'Ver empresa '+company.name} onClick={() => onCompanies(company.id)}><span><strong>{company.name}</strong><small>Vendas {money(company.income)} · Gastos {money(company.expenses)}</small></span><span className={'overview-company-balance '+(company.balance < 0 ? 'expense' : 'income')}><strong>{money(company.balance)}</strong><small>Saldo do mês</small></span><ChevronRight size={15}/></button></li>)}</ul>{companies.length > 3 && <button className="text-button overview-see-all" onClick={() => onCompanies()}>Ver todas as {companies.length} empresas<ChevronRight size={14}/></button>}</>
            : <div className="overview-empty"><p>Cadastre uma empresa para acompanhar notas, despesas e vendas.</p><button className="text-button" onClick={() => onCompanies()}>Cadastrar empresa<ChevronRight size={14}/></button></div>}
        </div>
      </section>
    </div>
    <p className="overview-note">Os valores seguem o mês selecionado e incluem as parcelas que vencem nele. Pessoal e empresas têm registros separados; o resumo acima reúne os dois. O saldo previsto não é o saldo da sua conta bancária.</p>
  </div>;
}
