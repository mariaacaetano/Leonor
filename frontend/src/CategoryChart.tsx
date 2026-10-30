import {useState} from 'react';
import {BarChart3,PieChart} from 'lucide-react';
import {buildCategoryChart} from './category-chart';
const money=(amount:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amount/100);
const percentage=(value:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value)+'%';
type Props={groups:{key:string,name:string,total:number}[],allCategoryNames:string[],activeCategory:string,onCategorySelect:(name:string)=>void};
export default function CategoryChart({groups,allCategoryNames,activeCategory,onCategorySelect}:Props){
  const [view,setView]=useState<'pie'|'bars'>('pie');
  const chart=buildCategoryChart(groups,allCategoryNames);
  const hasCredits=chart.creditTotal>0;
  const detail=(row:typeof chart.rows[number])=>row.total>0?percentage(row.percent)+' dos valores positivos':row.total<0?'Crédito líquido':'Saldo zero';
  const label=(row:typeof chart.rows[number])=>`${activeCategory===row.name?'Limpar filtro da categoria':'Filtrar categoria'} ${row.name}: ${money(row.total)} · ${detail(row)}`;
  return <section className="category-chart" aria-label="Distribuição da fatura por categoria">
    <div className="category-chart-heading"><div><h3>Distribuição por categoria</h3><p>Compras menos créditos · Resultados dos filtros</p></div><div className="category-chart-switch" role="group" aria-label="Tipo de gráfico"><button aria-pressed={view==='pie'} onClick={()=>setView('pie')}><PieChart size={15}/>Pizza</button><button aria-pressed={view==='bars'} onClick={()=>setView('bars')}><BarChart3 size={15}/>Barras</button></div></div>
    {view==='pie'?<div className="category-pie-layout">
      <div className="category-donut-area">{chart.positiveTotal>0?<>
        <svg viewBox="0 0 220 220" className="category-donut" aria-hidden="true" focusable="false"><circle cx="110" cy="110" r="80" fill="none" stroke="#e8eadf" strokeWidth="28"/>{chart.pieRows.map(row=><circle key={row.key} cx="110" cy="110" r="80" fill="none" stroke={row.color} strokeWidth="28" pathLength="100" strokeDasharray={`${row.percent} ${100-row.percent}`} strokeDashoffset={-row.offset} transform="rotate(-90 110 110)" className="category-donut-slice" onClick={()=>onCategorySelect(row.name)}><title>{row.name}: {money(row.total)} · {percentage(row.percent)}</title></circle>)}</svg>
        <div className="category-donut-center"><span>{hasCredits?'Saldos positivos':'Total por categoria'}</span><strong>{money(chart.positiveTotal)}</strong><small>{chart.pieRows.length} categoria{chart.pieRows.length===1?'':'s'}</small></div>
      </>:<div className="category-chart-zero"><PieChart size={33}/><strong>Sem saldo positivo para a pizza</strong><p>{hasCredits?'Os resultados contêm apenas créditos ou saldos zerados. Veja os valores no gráfico de barras.':'As compras e os créditos se compensam nas categorias selecionadas.'}</p>{hasCredits&&<button className="text-button" onClick={()=>setView('bars')}>Ver gráfico de barras</button>}</div>}</div>
      <div className={"category-chart-legend"+(chart.rows.length<=6?" short":"")} aria-label="Valores e percentuais por categoria" tabIndex={0}>{chart.rows.map(row=><button key={row.key} className="category-legend-row" aria-label={label(row)} aria-pressed={activeCategory===row.name} onClick={()=>onCategorySelect(row.name)}><i style={{background:row.color}}/><span>{row.name}<small>{detail(row)}</small></span><strong>{money(row.total)}</strong></button>)}</div>
    </div>:<div className={"category-bars-chart"+(chart.rows.length<=6?" short":"")} aria-label="Gráfico de barras por categoria" tabIndex={0}>
      {hasCredits&&<div className="category-bar-axis" aria-hidden="true"><span>Créditos líquidos</span><span>Valores positivos</span></div>}
      {chart.rows.map(row=><button key={row.key} className="category-bar-row" aria-label={label(row)} aria-pressed={activeCategory===row.name} onClick={()=>onCategorySelect(row.name)}><span className="category-bar-label"><span><i style={{background:row.color}}/>{row.name}</span><strong>{money(row.total)}<small>{row.total>0?percentage(row.percent):row.total<0?'Crédito líquido':'Saldo zero'}</small></strong></span><span className={'category-bar-track'+(hasCredits?' signed':'')}><span style={{background:row.color,width:`${row.barRatio*(hasCredits?50:100)}%`,left:hasCredits?`${row.total<0?50-row.barRatio*50:50}%`:'0'}}/></span></button>)}
    </div>}
    <div className="category-chart-footer"><span>Clique em uma categoria para filtrar as compras.</span>{hasCredits&&<strong>Abatimentos líquidos: {money(chart.creditTotal)}</strong>}</div>
    {hasCredits&&<p className="category-chart-credit-note">A pizza representa apenas os saldos positivos. Categorias com saldo negativo aparecem nas barras e na legenda.</p>}
  </section>;
}
