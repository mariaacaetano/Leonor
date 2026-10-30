export const categoryChartColors=['#173F35','#E7B29B','#7D9C86','#9B6551','#B9CBB9','#426657','#CF9278','#69836F','#B59D80','#305348','#DFC9B3','#8DAB99'];
type CategoryTotal={key:string,name:string,total:number};
export function buildCategoryChart(groups:CategoryTotal[],allCategoryNames:string[]=groups.map(group=>group.name)){
  const names=[...new Set([...allCategoryNames,...groups.map(group=>group.name)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const colors=new Map(names.map((name,index)=>[name,categoryChartColors[index%categoryChartColors.length]]));
  const positiveTotal=groups.reduce((sum,group)=>sum+Math.max(0,group.total),0);
  const creditTotal=groups.reduce((sum,group)=>sum+Math.max(0,-group.total),0);
  const maxAmount=groups.reduce((max,group)=>Math.max(max,Math.abs(group.total)),0);
  let offset=0;
  const rows=groups.map(group=>{
    const percent=positiveTotal>0&&group.total>0?group.total/positiveTotal*100:0;
    const row={...group,color:colors.get(group.name)!,percent,offset,barRatio:maxAmount>0?Math.abs(group.total)/maxAmount:0};
    offset+=percent;
    return row;
  });
  return {rows,pieRows:rows.filter(row=>row.total>0),positiveTotal,creditTotal,netTotal:positiveTotal-creditTotal,maxAmount};
}
