import {useState} from 'react';
import {ArrowRight, ArrowUpRight, ArrowDownLeft, Building2, Check, ChevronDown, CreditCard, GraduationCap, Layers3, Tags, UsersRound, Wallet} from 'lucide-react';
import './landing.css';

const examples = {
  personal: {label:'Pessoal', income:'R$ 3.500,00', expenses:'R$ 2.150,00', balance:'R$ 1.350,00', categories:[['Casa',40],['Alimentação',32],['Transporte',18],['Outros',10]]},
  business: {label:'Empresa', income:'R$ 8.400,00', expenses:'R$ 5.600,00', balance:'R$ 2.800,00', records:[['Compra de materiais','R$ 3.600,00'],['Serviços do mês','R$ 2.000,00']]}
} as const;

const features = [
  {icon:Tags, title:'Entenda para onde seu dinheiro vai', text:'Agrupe gastos por categoria e veja o que mais pesa no mês. Crie categorias que façam sentido para a sua rotina.'},
  {icon:CreditCard, title:'Acompanhe cartões e parcelas', text:'Veja as compras de cada fatura, distribua parcelas entre os meses e acompanhe o que ainda falta pagar.'},
  {icon:Building2, title:'Dê espaço à vida e ao negócio', text:'Organize entradas e gastos pessoais, registre compras e vendas da empresa e veja um resumo de cada parte.'},
  {icon:UsersRound, title:'Saiba quem paga o quê', text:'Identifique a pessoa responsável por um gasto e acompanhe os valores a receber e os reembolsos registrados.'}
];

const questions = [
  ['Preciso entender de finanças para usar?', 'Não. Você pode começar pelo básico: registrar o que entrou, o que saiu e escolher uma categoria. O resumo mensal ajuda a entender os números, um passo de cada vez.'],
  ['Posso organizar minhas finanças pessoais e minha empresa?', 'Sim. Cada uma tem seu próprio espaço e seus próprios registros. A visão geral mostra o resumo do mês e identifica a composição dos valores pessoais e empresariais.'],
  ['A Leonor se conecta à minha conta bancária?', 'Os registros são adicionados por você. A Leonor não se conecta ao banco nem realiza pagamentos. O saldo previsto é calculado a partir das entradas e dos gastos cadastrados.'],
  ['Como acompanho uma compra parcelada?', 'Informe o valor total e a quantidade de parcelas. A Leonor distribui os valores entre os meses. Nas compras no crédito, as faturas consideram o fechamento e o vencimento do cartão cadastrado.']
];

export default function LandingPage({signedIn,page='home'}:{signedIn:boolean,page?:'home'|'about'|'services'|'faq'|'not-found'}) {
  const [space, setSpace] = useState<'personal'|'business'>('personal');
  const example = examples[space];
  return <div className="landing-page">
    <a className="lp-skip" href="#conteudo">Pular para o conteúdo</a>
    <div className="lp-header-shell"><header className="lp-header">
      <a className="lp-logo" href="/" aria-label="Leonor — página inicial"><img src="/brand/leonor.svg" alt="Leonor" width="180" height="44"/></a>
      <nav className="lp-nav" aria-label="Navegação da apresentação"><a href="/servicos" aria-current={page==='services'?'page':undefined}>Como funciona</a><a href="/sobrenos" aria-current={page==='about'?'page':undefined}>Sobre nós</a><a href="/duvidas" aria-current={page==='faq'?'page':undefined}>Dúvidas</a></nav>
      <div className="lp-header-actions"><a className="lp-login" href={signedIn?'/conta/dash':'/login'}>{signedIn?'Minha conta':'Entrar'}</a><a className="lp-button lp-button-small" href="/signup">Começar<ArrowUpRight size={16}/></a></div>
    </header></div>

    <main className={"lp-main"+(page!=='home'?' lp-subpage':'')} id="conteudo" tabIndex={-1}>
      {page==='not-found'&&<section className="lp-not-found lp-container"><span className="lp-eyebrow">PÁGINA NÃO ENCONTRADA</span><h1>Vamos encontrar seu caminho?</h1><p>Este endereço não existe. Você pode voltar ao início ou entrar na sua conta.</p><a className="lp-button" href="/">Voltar ao início<ArrowRight size={18}/></a></section>}
      {(page==='about'||page==='services'||page==='faq')&&<div className="lp-page-heading lp-container"><a className="lp-link" href="/">← Página inicial</a><h1>{page==='about'?'Sobre nós':page==='services'?'Serviços e como funciona':'Dúvidas frequentes'}</h1><p>{page==='about'?'Conheça a história e quem desenvolve a Leonor.':page==='services'?'Veja o que a Leonor oferece e como começar.':'Encontre respostas para começar com mais clareza.'}</p></div>}
      {page==='home'&&<section className="lp-hero lp-container" aria-labelledby="lp-title">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">UM NOVO OLHAR PARA SUAS FINANÇAS</span>
          <h1 id="lp-title">Sua vida e seu negócio <span>em equilíbrio.</span></h1>
          <p>Entenda seus gastos, acompanhe seu mês e cuide do seu negócio. Com a Leonor, cada número ganha contexto e o próximo passo fica mais claro.</p>
          <div className="lp-actions"><a className="lp-button" href="/signup">Começar minha organização<ArrowRight size={18}/></a><a className="lp-link" href="/servicos">Conhecer a Leonor<ChevronDown size={16}/></a></div>
          <div className="lp-hero-note"><Check size={16} aria-hidden="true"/><span>Pessoal e empresa, cada um com seu espaço.</span></div>
        </div>
        <div className="lp-preview">
          <article className="lp-demo" aria-label="Exemplo ilustrativo do resumo financeiro">
            <div className="lp-demo-heading"><div><span className="lp-eyebrow">SEU MÊS, COM MAIS CLAREZA</span><h2>Vamos olhar seus números?</h2></div><img src="/brand/symbol.svg" alt="" width="38" height="38"/></div>
            <div className="lp-demo-switch" role="group" aria-label="Escolher exemplo"><button type="button" aria-pressed={space==='personal'} onClick={()=>setSpace('personal')}><Wallet size={16}/>Pessoal</button><button type="button" aria-pressed={space==='business'} onClick={()=>setSpace('business')}><Building2 size={16}/>Empresa</button></div>
            <div className="lp-demo-values" aria-live="polite" aria-atomic="true">
              <div className="lp-demo-balance"><span>Saldo previsto · {example.label}</span><strong>{example.balance}</strong><small>Entradas menos gastos registrados</small></div>
              <div className="lp-demo-movements"><div><span><ArrowDownLeft size={15}/>{space==='personal'?'Entradas':'Vendas'}</span><strong>{example.income}</strong></div><div><span><ArrowUpRight size={15}/>Gastos</span><strong>{example.expenses}</strong></div></div>
              {space==='personal'?<div className="lp-demo-categories"><h3>Onde estão os gastos?</h3>{examples.personal.categories.map(([label,percent],index)=><div className="lp-demo-category" key={label}><div><span>{label}</span><span>{percent}%</span></div><div className="lp-demo-track"><span style={{width:percent+'%',background:['#6f8d78','#b9cbb9','#e7b29b','#d9d9ca'][index]}}/></div></div>)}</div>:<div className="lp-demo-categories"><h3>Notas e despesas registradas</h3><div className="lp-demo-records">{examples.business.records.map(([name,amount])=><div key={name}><span><Building2 size={15}/>{name}</span><strong>{amount}</strong></div>)}</div><p className="lp-demo-records-note">Compras, despesas e vendas no mesmo lugar.</p></div>}
            </div>
            <div className="lp-demo-caption">Exemplo ilustrativo · valores fictícios</div>
          </article>
          <p className="lp-preview-note"><Layers3 size={17} aria-hidden="true"/>Uma visão do todo. Atenção a cada parte.</p>
        </div>
      </section>}

      {(page==='home'||page==='services')&&<section className="lp-features lp-container" id="recursos" aria-labelledby="lp-features-title">
        <div className="lp-section-heading"><div><span className="lp-eyebrow">O QUE A LEONOR OFERECE</span><h2 id="lp-features-title">Menos números soltos.<br/>Mais sentido no seu dia a dia.</h2></div><p>Ferramentas para organizar o presente e enxergar o que precisa da sua atenção.</p></div>
        <div className="lp-feature-grid">{features.map(({icon:Icon,title,text},index)=><article className="lp-feature" key={title}><span className={'lp-feature-icon lp-tone-'+index}><Icon size={23}/></span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>}

      {(page==='home'||page==='services')&&<section className="lp-how" id="como-funciona" aria-labelledby="lp-how-title"><div className="lp-container">
        <div className="lp-section-heading"><div><span className="lp-eyebrow">UM PASSO DE CADA VEZ</span><h2 id="lp-how-title">Começar pode ser simples.</h2></div><a className="lp-link" href="/signup">Criar minha conta<ArrowRight size={17}/></a></div>
        <ol className="lp-steps"><li><span>01</span><h3>Crie seu espaço</h3><p>Cadastre sua conta e escolha por onde começar: suas finanças pessoais ou sua empresa.</p></li><li><span>02</span><h3>Traga sua rotina</h3><p>Adicione entradas, gastos e cartões. Organize cada movimentação com uma categoria.</p></li><li><span>03</span><h3>Veja seu mês com clareza</h3><p>Confira os resumos, acompanhe as pendências e identifique os gastos que mais pesam.</p></li></ol>
      </div></section>}

      {(page==='home'||page==='about')&&<section className="lp-about lp-container" id="sobre-nos" aria-labelledby="lp-about-title">
        <div className="lp-about-copy"><span className="lp-eyebrow">SOBRE NÓS</span><h2 id="lp-about-title">Uma necessidade real.<br/>Uma solução com propósito.</h2><p>A Leonor nasceu da vontade de responder a uma pergunta comum: para onde o dinheiro está indo?</p><p>Mais do que anotar valores, era preciso categorizar os gastos, identificar o que desequilibra o orçamento e transformar números em informações compreensíveis.</p><p>Foi ao unir essa necessidade à paixão pelo desenvolvimento de soluções que <strong>Maria Fernanda Caetano</strong> criou a Leonor: uma plataforma para trazer mais clareza à organização financeira pessoal e empresarial, com uma experiência simples e acolhedora.</p><div className="lp-about-purpose"><img src="/brand/symbol.svg" width="38" height="38" alt=""/><span>Tecnologia feita para ajudar.<br/><strong>Clareza para a vida acontecer.</strong></span></div></div>
        <article className="lp-developer" aria-labelledby="lp-developer-name"><span className="lp-eyebrow">QUEM DESENVOLVE A LEONOR</span><div className="lp-developer-monogram" aria-hidden="true">MF<span/></div><h3 id="lp-developer-name">Maria Fernanda Caetano</h3><p className="lp-developer-role">Desenvolvedora da Leonor · 25 anos</p><div className="lp-education"><div><GraduationCap size={23} aria-hidden="true"/><div><h4>Sistemas de Informação</h4><p>Acadêmica do Instituto Federal Catarinense<br/><span>Campus Araquari</span></p></div></div><div><Building2 size={22} aria-hidden="true"/><div><h4>Técnica em Administração</h4><p>Formada pelo Instituto Federal Catarinense<br/><span>Campus São Francisco do Sul</span></p></div></div></div></article>
      </section>}

      {(page==='home'||page==='faq')&&<section className="lp-faq lp-container" id="duvidas" aria-labelledby="lp-faq-title"><div><span className="lp-eyebrow">PARA VOCÊ SE SENTIR EM CASA</span><h2 id="lp-faq-title">Antes do primeiro passo.</h2><p>Algumas respostas para conhecer melhor a Leonor.</p></div><div className="lp-faq-list">{questions.map(([question,answer])=><details key={question}><summary>{question}<PlusSign/></summary><p>{answer}</p></details>)}</div></section>}

      {page!=='not-found'&&<section className="lp-closing lp-container" aria-labelledby="lp-closing-title"><img src="/brand/symbol.svg" alt="" width="52" height="52"/><h2 id="lp-closing-title">Seu próximo passo<br/>começa com clareza.</h2><p>Um registro de cada vez. Uma visão mais tranquila da sua rotina.</p><a className="lp-button" href="/signup">Criar minha conta<ArrowRight size={18}/></a><a className="lp-link" href={signedIn?'/conta/dash':'/login'}>{signedIn?'Acessar minha conta':'Já tenho uma conta'}</a></section>}
    </main>
    <footer className="lp-footer lp-container"><a href="/" aria-label="Leonor — início"><img src="/brand/wordmark.svg" alt="Leonor" width="100" height="28"/></a><span>Sua vida e seu negócio em equilíbrio.</span><a href="/sobrenos">Feita por Maria Fernanda Caetano<ArrowUpRight size={14}/></a></footer>
  </div>;
}

function PlusSign() { return <span className="lp-faq-toggle" aria-hidden="true">+</span>; }
