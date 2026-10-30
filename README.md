# Leonor

<img src="frontend/public/brand/leonor.svg" alt="Leonor" width="260" />

**Sua vida e seu negócio em equilíbrio.**

A Leonor é uma plataforma de organização financeira pessoal e empresarial, em português, criada para ajudar a entender para onde o dinheiro vai. Reúne entradas, gastos, categorias, cartões e empresas em uma interface clara e acolhedora.

O código público do projeto está no repositório [mariaacaetano/Leonor](https://github.com/mariaacaetano/Leonor), na branch padrão **`Leonor`**.

## Por que a Leonor existe?

Anotar valores nem sempre é suficiente para entender as dificuldades do orçamento. A Leonor nasceu da necessidade de categorizar os gastos, identificar o que mais pesa e transformar números em informações compreensíveis. Essa necessidade, unida à paixão pelo desenvolvimento de soluções, deu origem à plataforma.

## O que a plataforma oferece

- **Visão geral do mês:** entradas, gastos, saldo previsto e pendências, com identificação dos valores pessoais e empresariais.
- **Categorias e pessoas:** criação e edição de categorias e identificação de quem paga cada gasto. Novas categorias e pessoas podem ser adicionadas durante o preenchimento de um lançamento.
- **Lançamentos pessoais:** entradas e despesas com busca, filtros, parcelamento, edição e acompanhamento de pagamentos.
- **Cartões e faturas:** fechamento e vencimento, parcelas por mês, pagamentos parciais, créditos, estornos e reembolsos.
- **Empresas:** compras, despesas, notas com itens, vendas e balanços mensal e acumulado.
- **Conta e perfil:** cadastro, login e edição de dados, contato, localização e senha.
- **Apresentação pública:** landing page, recursos e como funciona, perguntas frequentes e a história da fundadora.

Os valores monetários são tratados em centavos, com distribuição das diferenças de arredondamento entre as parcelas. O saldo é uma previsão baseada nos registros cadastrados; a plataforma não se conecta a bancos nem realiza pagamentos.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | React 19, TypeScript, Vite e Lucide |
| API | Python, FastAPI, SQLAlchemy e PyJWT |
| Dados | PostgreSQL no Docker; SQLite no desenvolvimento local |
| Infraestrutura | Docker Compose e Nginx |
| Verificação | Pytest e testes nativos do Node.js |

A autenticação usa JWT, e as senhas são armazenadas com scrypt. Os registros são associados à conta do usuário, com verificação de acesso no backend.

## Executar com Docker

Pré-requisito: Docker com Docker Compose.

Clone a branch pública e entre na pasta do projeto:

```sh
git clone --branch Leonor --single-branch https://github.com/mariaacaetano/Leonor.git
cd Leonor
cp .env.example .env
```

Gere **dois valores distintos**, executando este comando duas vezes:

```sh
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Preencha `SECRET_KEY` e `POSTGRES_PASSWORD` no `.env` com os valores gerados. Depois, execute:

```sh
docker compose up --build -d
```

Acesse [http://localhost:8080](http://localhost:8080). A página inicial apresenta a Leonor e oferece acesso ao login e ao cadastro.

O PostgreSQL mantém os dados em um volume persistente. Em uma instalação existente, mantenha o valor de `COMPOSE_PROJECT_NAME` usado anteriormente para continuar utilizando os mesmos contêineres e volumes. Não use `docker compose down -v` se quiser preservar os dados.

## Desenvolvimento local

Requisitos: Python 3.12 e Node.js 22 ou superior.

### Backend

A partir da raiz:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

Sem `DATABASE_URL`, o backend usa SQLite. A documentação da API fica em [http://localhost:8002/docs](http://localhost:8002/docs).

### Frontend

Em outro terminal, a partir da raiz:

```sh
cd frontend
npm ci
npm run dev
```

Acesse [http://localhost:5173](http://localhost:5173). O Vite procura a API local na porta 8002 e, se ela não estiver disponível, utiliza a aplicação Docker na porta configurada no `.env`.

## Estrutura

```text
Leonor/
├── backend/
│   ├── app/                 # API, autenticação e regras financeiras
│   └── tests/               # Testes do backend
├── frontend/
│   ├── public/
│   │   ├── brand/           # Logos, fontes e licença das fontes
│   │   └── images/          # Foto da fundadora
│   ├── src/                 # Telas, componentes, estilos e rotas
│   └── tests/               # Testes dos cálculos e filtros
├── docs/GUIA_TECNICO.md      # Regras de cálculo, rotas e operação
├── .env.example             # Modelo de configuração sem credenciais
└── compose.yaml             # Serviços Docker
```

## Páginas e navegação

| Endereço | Conteúdo |
| --- | --- |
| `/` | Apresentação da Leonor |
| `/login` e `/signup` | Acesso e cadastro |
| `/servicos`, `/sobrenos` e `/duvidas` | Conteúdo público |
| `/conta/dash` | Visão geral da conta |
| `/conta/lancamentos` | Entradas e gastos pessoais |
| `/conta/tags` | Categorias e pessoas |
| `/conta/cartoes` | Cartões e faturas |
| `/conta/empresas` | Registros empresariais |
| `/conta/perfil` | Dados e senha |

Ações têm caminhos próprios, como `/conta/tags/adicionar-tags`. Links diretos, atualização e voltar/avançar preservam a tela correspondente. O mês selecionado é identificado por `?mes=AAAA-MM`. A lista completa está no [guia técnico](docs/GUIA_TECNICO.md).

## Verificação

Com o ambiente Python ativado, execute na raiz:

```sh
python -m pytest -q
npm --prefix frontend test
npm --prefix frontend run build
```

Os testes cobrem autenticação, isolamento entre contas, cadastro e perfil, valores em centavos, parcelamento, faturas, pagamentos, reembolsos e registros empresariais.

## Commits da branch Leonor

Os commits usam prefixos para indicar a intenção da alteração:

| Prefixo | Uso |
| --- | --- |
| `feat:` | Funcionalidade nova |
| `fix:` | Correção de comportamento |
| `update:` | Atualização geral de conteúdo ou recursos |
| `docs:` | Documentação |
| `refactor:` | Reorganização sem mudar o comportamento |
| `test:` | Testes |
| `chore:` | Manutenção e configuração |

Exemplos: `feat: adiciona visão de gastos por categoria` e `fix: preserva o mês ao abrir uma fatura`.

Arquivos `.env`, bancos locais, backups, dependências e preferências do editor ficam fora do versionamento. Use somente dados fictícios em exemplos e testes enviados ao repositório.

## Quem desenvolve

**Maria Fernanda Caetano** — desenvolvedora da Leonor, acadêmica de Sistemas de Informação no Instituto Federal Catarinense, Campus Araquari, e formada como Técnica em Administração pelo Instituto Federal Catarinense, Campus São Francisco do Sul.

GitHub: [@mariaacaetano](https://github.com/mariaacaetano).

A foto apresentada no “Sobre nós” fica em `frontend/public/images/perfil-founder.jpeg`. A identidade visual utiliza bosque, marfim, sálvia e pêssego, com fontes DejaVu servidas localmente. A [licença das fontes](frontend/public/brand/fonts/LICENCA_DejaVu.txt) acompanha os arquivos.

## Detalhes de operação

Consulte o [guia técnico](docs/GUIA_TECNICO.md) para regras de cálculo, parcelamento, configuração do proxy, backup e limitações atuais de publicação.
