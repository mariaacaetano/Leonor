import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildCategoryChart} from '../src/category-chart.ts';
import {groupInvoiceCategories} from '../src/invoice.ts';

test('pie percentages use positive net installment balances; credit and zero categories remain in bar data',()=>{
  const groups=groupInvoiceCategories([
    {category:'Mercado',kind:'expense',amount:3334,total_amount:10000},
    {category:'Mercado',kind:'income',amount:1000},
    {category:'Saúde',kind:'expense',amount:1666},
    {category:'Créditos',kind:'income',amount:500},
    {category:'Zerada',kind:'expense',amount:100},
    {category:'Zerada',kind:'income',amount:100},
  ]);
  const chart=buildCategoryChart(groups);
  assert.equal(chart.positiveTotal,4000);
  assert.equal(chart.creditTotal,500);
  assert.equal(chart.netTotal,3500);
  assert.equal(chart.rows.length,4);
  assert.deepEqual(chart.pieRows.map(row=>row.name),['Mercado','Saúde']);
  assert.ok(Math.abs(chart.pieRows[0].percent-58.35)<1e-9);
  assert.ok(Math.abs(chart.pieRows[1].offset-58.35)<1e-9);
  assert.ok(Math.abs(chart.pieRows.reduce((sum,row)=>sum+row.percent,0)-100)<1e-9);
  assert.equal(chart.rows.find(row=>row.name==='Créditos').total,-500);
  assert.equal(chart.rows.find(row=>row.name==='Créditos').percent,0);
  assert.equal(chart.rows.find(row=>row.name==='Zerada').barRatio,0);
});

test('colors stay consistent when sorting or filtering and percentages renormalize to filtered results',()=>{
  const groups=[{key:'a',name:'Água',total:1000},{key:'b',name:'Mercado',total:3000}];
  const names=groups.map(group=>group.name);
  const initial=buildCategoryChart(groups,names);
  const reversed=buildCategoryChart([...groups].reverse(),names);
  assert.equal(initial.rows[0].color,reversed.rows[1].color);
  const filtered=buildCategoryChart([groups[1]],names);
  assert.equal(filtered.rows[0].color,initial.rows[1].color);
  assert.equal(filtered.rows[0].percent,100);
  assert.equal(filtered.positiveTotal,3000);
  assert.equal(initial.rows[0].percent,25);
  assert.deepEqual(groups.map(group=>group.name),['Água','Mercado']);
});

test('empty, zero, single-category and credit-only data produce finite geometry without false positive slices',()=>{
  for(const groups of [[],[{key:'zero',name:'Zerada',total:0}],[{key:'credit',name:'Crédito',total:-500}]]){
    const chart=buildCategoryChart(groups);
    assert.equal(chart.positiveTotal,0);
    assert.deepEqual(chart.pieRows,[]);
    for(const row of chart.rows){assert.ok(Number.isFinite(row.barRatio));assert.equal(row.percent,0);assert.equal(row.offset,0);}
  }
  const single=buildCategoryChart([{key:'one',name:'Mercado',total:3334}]);
  assert.equal(single.pieRows[0].percent,100);
  assert.equal(single.pieRows[0].barRatio,1);
});
