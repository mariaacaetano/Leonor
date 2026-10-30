# Leonor

Controle financeiro pessoal e empresarial em português, com React + TypeScript, FastAPI e PostgreSQL. Cada usuário acessa apenas seus registros, com autenticação JWT e senhas protegidas por scrypt.

## Identidade visual

A interface segue o guia da pasta `Leonor`: bosque (#173F35), marfim (#F7F3E9), sálvia (#B9CBB9) e pêssego (#E7B29B). Os logos e as fontes DejaVu são servidos localmente em `frontend/public/brand`, com a licença das fontes incluída. Os estilos compartilhados da marca ficam em `frontend/src/leonor.css`.

A composição prioriza superfícies claras em marfim e branco, com sálvia suave e verde nos detalhes e ações. No login e no cadastro, o painel de apresentação usa fundo bosque, logo branco e textos claros. Títulos editoriais usam DejaVu Serif; textos, controles e números usam DejaVu Sans. A navegação inclui rótulos visíveis no celular, e o resumo explica o saldo previsto e separa a composição pessoal e empresarial.

## Páginas e navegação

A raiz (`/`) é sempre a landing page, mesmo quando há uma sessão ativa. As páginas públicas são `/login`, `/signup`, `/duvidas`, `/sobrenos` e `/servicos` (recursos e como funciona). Os formulários de acesso mantêm o painel verde da marca.

As telas da conta usam caminhos próprios:

| Caminho | Tela ou ação |
| --- | --- |
| `/conta/dash` | Visão geral após o login |
| `/conta/lancamentos` | Entradas e gastos |
| `/conta/lancamentos/adicionar` | Novo lançamento |
| `/conta/lancamentos/:id/editar` | Editar uma compra ou entrada |
| `/conta/tags` | Categorias e pessoas que pagam |
| `/conta/tags/adicionar-tags` | Nova categoria |
| `/conta/tags/:id/editar` | Editar categoria |
| `/conta/tags/adicionar-pessoa` | Nova pessoa |
| `/conta/cartoes` | Cartões e faturas |
| `/conta/cartoes/adicionar` | Novo cartão |
| `/conta/cartoes/:id/fatura` | Fatura do cartão |
| `/conta/cartoes/:id/fatura/adicionar-pagamento` | Registrar pagamento da fatura |
| `/conta/cartoes/:id/fatura/lancamentos/:lancamentoId/editar` | Editar uma compra a partir da fatura |
| `/conta/cartoes/:id/fatura/pagamentos/:pagamentoId/editar` | Editar pagamento da fatura |
| `/conta/empresas` | Empresas |
| `/conta/empresas/adicionar` | Nova empresa |
| `/conta/empresas/:id` | Empresa selecionada |
| `/conta/empresas/:id/editar` | Editar empresa |
| `/conta/empresas/:id/despesas/adicionar` | Nova despesa ou nota |
| `/conta/empresas/:id/vendas/adicionar` | Nova venda |
| `/conta/empresas/:id/registros/:registroId/editar` | Editar nota, despesa ou venda |
| `/conta/perfil` | Dados e senha da conta |

O mês selecionado é preservado em `?mes=AAAA-MM`. Links diretos, atualização e voltar/avançar do navegador abrem a tela e o formulário correspondentes. Uma URL protegida sem sessão leva ao login e retorna ao destino após autenticar; o acesso normal vai para `/conta/dash`. A autorização dos registros continua no backend.

Os endereços anteriores `/cadastro` e `/app` redirecionam para `/signup` e `/conta/dash`. `/conta` também leva ao painel, e `/serviços` é aceito como alternativa para `/servicos`. Barras finais são normalizadas. Endereços desconhecidos exibem uma página não encontrada.

O conteúdo público e a biografia ficam em `frontend/src/LandingPage.tsx`, com estilos em `frontend/src/landing.css`. A configuração de caminhos fica em `frontend/src/routes.ts`. Atualize a idade na biografia quando necessário.

## Executar com Docker

1. Copie `.env.example` para `.env`.
2. Gere **dois valores distintos** com `python3 -c "import secrets; print(secrets.token_hex(32))"` e preencha `SECRET_KEY` e `POSTGRES_PASSWORD`.
3. Execute `docker compose up --build -d`.
4. Acesse http://localhost:8080 e crie sua conta.

O PostgreSQL mantém os registros no volume `postgres_data`. Não execute `docker compose down -v` se quiser preservar os dados. O backend e o banco ficam na rede interna; apenas o frontend é exposto.

## Funcionalidades

- Cadastro com nome completo, e-mail, telefone com DDD e senha obrigatórios; país, estado/região e cidade opcionais, sem pedir data de nascimento. Login exige somente e-mail e senha; sessão de 12 horas armazenada em sessionStorage.
- Tela Perfil, também acessível pelo nome da conta na barra lateral, com edição de nome, e-mail, telefone, país, estado/região, cidade e data de nascimento opcional. Trocas de e-mail e senha exigem a senha atual e invalidam sessões anteriores, mantendo o navegador atual conectado. A senha nova deve ter de 8 a 128 caracteres e ser confirmada. A atualização adiciona campos à tabela de usuários preservando contas, sessões e registros existentes; a localização de contas antigas começa vazia. Telefones preenchidos aceitam formatação e de 8 a 15 dígitos, incluindo DDD/código do país; os dados são validados e os espaços nas extremidades são removidos.
- O acesso padrão após login e cadastro abre a Visão geral, com resumo compacto do mês para pessoal e empresas: entradas, gastos e saldo combinado, pendências e principais categorias pessoais, e vendas, gastos e saldo por empresa. Atalhos levam aos lançamentos completos ou à empresa selecionada. O resumo é atualizado ao voltar para a Visão geral. Despesas empresariais parceladas entram pelo valor das parcelas do mês.
- Novas contas começam somente com as categorias Mercado, Higiene, Delivery, Gasolina, Farmácia e Academia, com criação, renomeação e exclusão. Categorias também podem ser criadas diretamente no formulário de gasto, sem perder os campos preenchidos; a nova categoria fica selecionada automaticamente. Categorias usadas em lançamentos exigem uma categoria de destino antes de excluir; a transferência considera todos os meses e preserva compras, parcelas, pagamentos e reembolsos.
- Tags de pessoas que pagam, cadastradas e renomeadas em Categorias; também podem ser criadas diretamente no formulário de gasto ou pagamento parcial, sem perder os campos preenchidos. A nova tag fica selecionada automaticamente. Tags são exibidas junto à categoria. Nomes de reembolso existentes são convertidos em tags.
- Tabela de lançamentos exibe o total original da compra; a fatura exibe o valor de cada parcela. Resumos mensais continuam usando os vencimentos do mês.
- Entradas e despesas via Pix, dinheiro, débito, crédito, transferência e boleto.
- Cartão vinculado às compras no crédito ou débito; faturas mensais incluem apenas operações no crédito.
- Cartões com nome, fechamento e vencimento, sem armazenar números de cartão.
- Fatura detalhada em modal, com troca de cartão e mês, busca, filtros combináveis e ordenação. Visões por lançamento, categoria e pessoa exibem os valores das parcelas daquela fatura; cada pessoa mostra as compras, o total a receber e os reembolsos recebidos. A visão por categoria inclui gráficos de pizza e barras que acompanham os filtros; clicar em uma categoria filtra as compras. Os gráficos usam os valores líquidos das parcelas, com créditos descontados; saldos negativos aparecem nas barras e na legenda. Pagamentos ficam em uma visão própria, com busca, ordenação e edição.
- Pagamento parcial do cartão com valor, data, tag de quem pagou e seleção da fatura. O histórico aparece na fatura e os pagamentos reduzem o restante a pagar, sem lançar as compras novamente como despesas.
- Parcelas automáticas para gastos e entradas; valores em centavos, sem perda por arredondamento.
- Créditos no cartão, como estornos, abatem a fatura; são exibidos como entradas no resumo.
- Marcação individual de parcelas como pagas ou recebidas; exclusão de uma operação remove todas as parcelas.
- Edição de compras e entradas pelo ícone de lápis na tabela ou na fatura, com dados preenchidos e atualização de todas as parcelas. Preserva IDs e marcações de pagamento das parcelas mantidas; impede remover parcelas pagas ou com reembolso recebido. Alterar a pessoa responsável ou a forma de pagamento limpa as marcações de reembolso.
- Escolha da fatura de destino de cada parcela no cadastro e na edição, pelo mês de vencimento. No cadastro, sugere os meses conforme a data, fechamento e vencimento do cartão, permite substituir cada destino e acompanha a quantidade de parcelas; preserva valores, data da compra e marcações de pagamento. Edições sem mudança de data, cartão ou quantidade de parcelas preservam os destinos escolhidos.
- Edição dos pagamentos parciais na fatura, incluindo valor, data, pessoa, cartão e fatura de destino; mantém a fatura registrada por padrão.
- Lançamentos cadastrados mais recentemente no topo por padrão, com ordenação por cadastro, vencimento, valor total e descrição. Editar uma compra preserva sua posição na ordem de cadastro.
- Pesquisa por descrição, categoria, origem, credor ou pessoa, com filtros combináveis por tipo, status, categoria, pagamento, cartão e pessoa. Os filtros atuam na lista do mês selecionado.
- Navegação entre meses.
- Atalho para novo lançamento: Ctrl + Alt + N no Windows/Linux ou ⌘ + Option + N no Mac, com a página em foco e fora dos campos de preenchimento.

## Regras de cálculo

### Empresas

A aba **Empresas** permite cadastrar e renomear empresas, registrar despesas simples ou notas com local/fornecedor, data, valor e até 120 parcelas, e registrar entradas de vendas com descrição geral. Cada nota pode conter vários itens com descrição, quantidade (até três casas decimais), valor total e custo por peça calculado automaticamente como valor total dividido pela quantidade. O total da nota é a soma dos itens; custos unitários são exibidos com até seis casas decimais para preservar a precisão.

O balanço mensal considera as vendas na data da entrada e as parcelas de despesas que vencem no mês selecionado. A primeira parcela fica na data da compra. O balanço acumulado considera o valor integral de todas as compras e vendas, incluindo parcelas futuras. Os valores representam o resultado dos registros, sem controle de liquidação ou estoque. A lista pode mostrar o mês ou todo o histórico, com busca por descrição, local e itens. Abra cada registro para ver os itens e o parcelamento.

Empresas e registros podem ser editados; editar ou excluir uma nota ou venda recalcula os balanços. Empresas com registros só podem ser excluídas depois de remover esses registros. Cada usuário acessa apenas suas próprias empresas, e os registros empresariais têm balanço separado das finanças pessoais. A atualização cria três novas tabelas sem alterar os registros existentes.

### Finanças pessoais

O valor informado é sempre o **total da operação**. R$ 100 em 3 vezes gera R$ 33,34, R$ 33,33 e R$ 33,33.

No crédito, compras até o dia de fechamento (inclusive) entram no ciclo atual; compras após esse dia entram no próximo ciclo. Se o vencimento for anterior ou igual ao fechamento, ocorre no mês seguinte ao fechamento. Exemplo: fechamento dia 25, vencimento dia 5, compra em 26 de janeiro → primeira parcela em 5 de março. Compras em 25 de janeiro → 5 de fevereiro. Confirme a regra do dia de fechamento com seu emissor antes de lançar compras nesse dia.

Outros pagamentos geram a primeira parcela na data informada e as seguintes no mesmo dia dos meses seguintes. Dias inexistentes são ajustados ao último dia do mês, retomando o dia original nos meses posteriores.

A opção **Fatura atual** nos pagamentos parciais usa o ciclo aberto na data do pagamento e identifica a fatura pelo mês do vencimento. Até o fechamento (inclusive), usa o ciclo atual; após o fechamento, usa o próximo. É possível escolher outro mês manualmente, inclusive uma fatura já fechada. Pagamentos acima do total deixam o restante em zero; os valores registrados são preservados. Quando também existem parcelas marcadas como pagas, o restante considera o maior entre os pagamentos registrados e a soma dessas parcelas, para evitar abater o mesmo pagamento duas vezes.

O saldo é **previsto por vencimento**, não um saldo bancário conciliado. Entradas no crédito representam abatimentos na fatura. Pagar uma fatura significa marcar suas parcelas como pagas, evitando lançar a mesma despesa novamente. Não há conexão com bancos nem realização de pagamentos.

## Desenvolvimento local

Backend (Python 3.12 recomendado):

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
cd backend
uvicorn app.main:app --reload --port 8002
```

Sem `DATABASE_URL`, o backend usa SQLite (`backend/finance.db`). Documentação da API: http://localhost:8002/docs.

Frontend, em outro terminal (Node 22 recomendado):

```sh
cd frontend
npm ci
npm run dev
```

Acesse http://localhost:5173. Ao iniciar, o Vite procura o backend em `http://127.0.0.1:8002`. Se ele não estiver disponível, encaminha `/api` para o app Docker em `http://127.0.0.1:8080` (ou na porta `PORT` definida no `.env` da raiz). Assim, é possível executar somente o frontend com `npm run dev` usando a API e o banco do Docker. Se iniciar o backend local depois do Vite, reinicie o frontend para detectar a mudança. Para escolher um destino explicitamente, use `API_PROXY_TARGET=http://127.0.0.1:PORTA npm run dev`.

## Verificação

```sh
cd backend
python3 -m pytest -q
```

```sh
cd frontend
npm ci
npm test
npm run build
```

Os testes verificam autenticação, isolamento por usuário, arredondamento, vencimentos, fechamento de cartões, créditos, pagamentos e exclusão de parcelas.

## Publicação online

Em um servidor com Docker Compose, configure `.env` e execute `docker compose up --build -d`. Aponte o domínio para o servidor e coloque um proxy HTTPS, como Caddy ou Nginx, na frente da porta escolhida em `PORT`. Faça backup do PostgreSQL antes de atualizações:

```sh
docker compose exec -T db pg_dump -U meusaldo meusaldo > backup.sql
```

A aplicação cria as tabelas automaticamente na primeira inicialização. Mudanças futuras de esquema devem usar migrações antes de atualizar bancos existentes. Esta versão não inclui recuperação de senha, verificação de e-mail ou limitação de tentativas de login; configure proteção contra abuso no proxy antes de abrir cadastros ao público.
