export type AccountView = 'overview'|'transactions'|'cards'|'categories'|'companies'|'profile';
export const accountPaths:Record<AccountView,string> = {
  overview:'/conta/dash', transactions:'/conta/lancamentos', cards:'/conta/cartoes',
  categories:'/conta/tags', companies:'/conta/empresas', profile:'/conta/perfil'
};
export type AccountRoute = {
  view:AccountView;
  parent:string;
  modal?:'transaction'|'category'|'person-tag'|'card';
  transactionId?:number;
  categoryId?:number;
  cardId?:number;
  paymentId?:number;
  companyId?:number;
  companyAction?:'add'|'edit'|'expense'|'income'|'record';
  recordId?:number;
};
export function normalizePath(value:string):string {
  let path=value.split('?')[0];
  try {path=decodeURI(path);}catch {return path;}
  path=path.replace(/\/+$/,'')||'/';
  return ({'/cadastro':'/signup','/app':'/conta/dash','/conta':'/conta/dash','/serviços':'/servicos','/sobre-nos':'/sobrenos'} as Record<string,string>)[path]||path;
}
export function accountRoute(path:string):AccountRoute|null {
  for(const [view,base] of Object.entries(accountPaths))if(path===base)return {view:view as AccountView,parent:base};
  if(path==='/conta/lancamentos/adicionar')return {view:'transactions',modal:'transaction',parent:accountPaths.transactions};
  if(path==='/conta/cartoes/adicionar')return {view:'cards',modal:'card',parent:accountPaths.cards};
  if(path==='/conta/tags/adicionar-tags')return {view:'categories',modal:'category',parent:accountPaths.categories};
  if(path==='/conta/tags/adicionar-pessoa')return {view:'categories',modal:'person-tag',parent:accountPaths.categories};
  let match=path.match(/^\/conta\/tags\/([1-9]\d*)\/editar$/);
  if(match)return {view:'categories',modal:'category',categoryId:Number(match[1]),parent:accountPaths.categories};
  match=path.match(/^\/conta\/lancamentos\/([1-9]\d*)\/editar$/);
  if(match)return {view:'transactions',modal:'transaction',transactionId:Number(match[1]),parent:accountPaths.transactions};
  match=path.match(/^\/conta\/cartoes\/([1-9]\d*)\/fatura(?:\/(adicionar-pagamento|lancamentos\/([1-9]\d*)\/editar|pagamentos\/([1-9]\d*)\/editar))?$/);
  if(match)return {view:'cards',cardId:Number(match[1]),modal:match[2]?'transaction':undefined,transactionId:match[3]?Number(match[3]):undefined,paymentId:match[4]?Number(match[4]):undefined,parent:match[2]?`/conta/cartoes/${match[1]}/fatura`:accountPaths.cards};
  if(path==='/conta/empresas/adicionar')return {view:'companies',companyAction:'add',parent:accountPaths.companies};
  match=path.match(/^\/conta\/empresas\/([1-9]\d*)(?:\/(editar|despesas\/adicionar|vendas\/adicionar|registros\/([1-9]\d*)\/editar))?$/);
  if(match)return {view:'companies',companyId:Number(match[1]),companyAction:match[2]?(match[2]==='editar'?'edit':match[2]==='despesas/adicionar'?'expense':match[2]==='vendas/adicionar'?'income':'record'):undefined,recordId:match[3]?Number(match[3]):undefined,parent:match[2]?`/conta/empresas/${match[1]}`:accountPaths.companies};
  return null;
}
export function routeTitle(path:string):string {
  const publicTitles:Record<string,string>={'/login':'Entrar','/signup':'Criar conta','/duvidas':'Dúvidas','/sobrenos':'Sobre nós','/servicos':'Serviços e como funciona'};
  if(publicTitles[path])return publicTitles[path]+' · Leonor';
  const route=accountRoute(path);
  if(route)return ({overview:'Visão geral',transactions:'Lançamentos',cards:'Cartões e faturas',categories:'Categorias e pessoas',companies:'Empresas',profile:'Meu perfil'}[route.view])+' · Leonor';
  return path==='/'?'Leonor · Sua vida e seu negócio em equilíbrio':'Página não encontrada · Leonor';
}
export function validMonth(value:string|null):value is string {return !!value&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value);}
