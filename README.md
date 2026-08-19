# Altair

Sistema completo de gestão para igrejas — membros, finanças, congressos/
eventos, e mais. Pensado pra ser vendido como SaaS: cada igreja cliente
ganha sua própria instância, isolada e vazia. Estrutura multi-congregação:
uma sede, várias congregações vinculadas, cada uma com seu próprio acesso
e seus próprios dados.

**Nome do sistema**: "Altair" é o nome padrão, mas pode ser trocado a
qualquer momento em Congregações → Personalização da tela de login.

**Ícone do navegador (favicon)**: foi removido de propósito — troque o
arquivo `public/favicon.ico` pelo seu próprio ícone antes do próximo
`docker compose up -d --build`.

## Login

Login único da equipe (usuário + senha), em `/auth`.

- Login inicial da igreja: `admin` / `admin123`
- Login master (suporte/operador do SaaS): `master` / `master123`

Ambos são obrigados a trocar a senha no primeiro acesso.

> Login de membro via Google (app do membro) e Pedidos de Oração foram
> removidos por enquanto, a pedido — o sistema hoje é só pro uso interno
> da equipe. Podem voltar depois.

## Papéis

| Papel | Acesso |
|---|---|
| **Master** | Você (operador do SaaS). Vê tudo nesta instância, nunca é bloqueado por licença vencida, configura o recebimento da mensalidade e confirma pagamentos |
| **Admin** | Topo da igreja — todas as congregações, financeiro, usuários, recebe as prestações de contas |
| **Coordenador** | Membros e financeiro da própria congregação, com poder de **editar/apagar** lançamentos e enviar prestação de contas |
| **Usuário** | Cadastra membros e **lança** despesas/entradas normalmente — mas não edita nem apaga lançamento já feito, nem envia prestação de contas (isso é só coordenador pra cima) |

**Importante**: exceto Master e Admin, todo usuário é vinculado a **uma
congregação específica** (definido em Usuários) e só enxerga os membros
e o financeiro daquela congregação — nunca de outra.

## Licença / assinatura mensal

Cada instância nasce com **30 dias de teste grátis**. Depois disso:

1. **Configuração** (feita por você, o master): clique no indicador
   discreto perto do seu nome (bolinha colorida + dias restantes) →
   cadastre a chave PIX e os valores — a mensalidade é calculada
   sozinha: **valor da sede + (valor por congregação × quantas
   congregações existem)**. Pode mudar os dois valores a qualquer hora
2. **Indicador discreto**: a tela de Licença fica escondida do menu —
   só aparece uma bolinha + "X dias" perto do seu nome, que ao clicar
   **abre a tela completa de licença** (`/licenca`), com status, valor,
   renovação, **faturas em aberto** e **histórico de pagamentos**
   (admin vê tudo isso; master também configura por lá)
3. **Aviso de vencimento**: nos últimos 5 dias antes de vencer, o
   indicador fica destacado
4. **Vencimento**: quando passa da data, a instância fica **totalmente
   bloqueada** — nenhum menu funciona, nenhuma tela abre, pra ninguém
   (só o master nunca é bloqueado, já que ele é quem resolve o
   pagamento) — inclusive se vencer no meio de uma sessão já aberta, o
   acesso é cortado sozinho em até 5 minutos
5. **Tela de bloqueio**: quando alguém tenta logar com a licença
   vencida, em vez de entrar, aparece a tela de pagamento (PIX real, QR
   Code) — é só escanear e pagar
6. **Liberação**: você (master) confirma o recebimento no painel da
   licença — ela é renovada automaticamente pelos meses pagos, e o
   acesso volta assim que a pessoa tentar de novo

**Sobre cartão de crédito**: a estrutura já prevê o campo, mas cobrança
automática por cartão exige contratar um gateway de pagamento
(Mercado Pago, Stripe, Asaas) com credenciais reais — isso o código
sozinho não resolve.

## Personalização (logo e tela de login)

Só quem é **Admin** ou **Master** edita (a personalização é sempre feita
pela matriz/sede, nunca por uma congregação sozinha) — em **Congregações**:

- **Personalização da tela de login** (topo da página) — nome do sistema,
  logo, imagem de fundo, cor primária. Vale pra instância inteira, é o
  que aparece pra qualquer um que tentar entrar em `/auth`
- **Logo por congregação** (em cada card de congregação) — aparece no
  cadastro dela; pode ser diferente por congregação, se quiser

## Módulos prontos

- **Dashboard** — indicadores (membros ativos, novos convertidos, ofertas
  do mês, aniversariantes) — escopado pela congregação de quem está logado
- **Membros** — cadastro completo (dados pessoais, histórico espiritual:
  conversão/batismo/recepção, família, situação, **líder/pastor
  responsável vinculado**), busca e filtro, escopado por congregação
- **Pastoreio** — visitas/aconselhamentos, acesso restrito só a pastores
- **Financeiro** — entradas e saídas por categoria, **gráficos** (entradas
  x saídas por mês, entradas por categoria), PIX vinculado a membro
- **Prestar Contas** — cada congregação fecha o mês e envia pra sede toda
  a movimentação financeira do período; a sede recebe e consulta o
  detalhe de cada envio (ver seção própria abaixo)
- **Congregações** — estrutura multi-congregação (sede + filiais),
  só o Pastor Presidente administra
- **Congressos e Eventos** — **calendário mensal com os eventos de todas
  as congregações** (mais uma visão em lista), inscrição, controle de
  uniforme, financeiro por participante, checklist configurável,
  check-in por QR Code, relatórios/exportação (CSV/Excel), comunicação
  via WhatsApp
- **Cultos e Escalas** — **calendário mensal**, escala de pessoas por
  função (Louvor, Mídia, Recepção, Diáconos, Intercessão, Limpeza,
  Transmissão), com status confirmar/troca solicitada/recusado. Cada
  congregação vê sua própria agenda **+ a da sede**; admin/master
  entram no cadastro de qualquer congregação (em Congregações → "Ver
  cultos"/"Ver EBD") pra ver e editar a agenda dela especificamente
- **EBD (Escola Bíblica)** — turmas, professor, matrícula de alunos,
  chamada de frequência por data com histórico, e um painel com 4
  gráficos: pizza das turmas com maior frequência, barras comparando
  inscritos x média de presentes no mês, evolução semanal de presença
  por turma (escolhível), e ranking dos 10 membros mais presentes
- **Documentos** — gera Carta de Transferência pronta pra impressão,
  puxando os dados do membro e da congregação automaticamente
- **Carteirinha Digital** — cartão de identificação imprimível (foto,
  dados, QR Code) — na página de cada membro
- **Certificados** — de Batismo e Membresia, imprimíveis, com data por
  extenso — puxados automaticamente dos dados do membro
- **Relatórios avançados** — faixa etária geral de todos os membros
  (Dashboard) e comparativo financeiro ano a ano (Financeiro)

## Prestação de Contas — como funciona

1. A congregação lança as entradas/saídas do mês normalmente em Financeiro
2. No menu **Prestar Contas**, escolhe o mês/ano — o sistema mostra tudo
   que ainda não foi enviado (com o resumo de entradas/saídas/saldo)
3. Clica em **"Enviar prestação de contas"** — a partir daí, esses
   lançamentos ficam marcados como "já enviados" e não podem mais ser
   apagados (só consultados)
4. A sede (Pastor Presidente) vê, no mesmo menu, todas as prestações
   recebidas de todas as congregações, com o detalhe de cada uma

## Mural de avisos

Admin/master manda avisos em **Avisos** — pra todas as congregações ou só
pra uma específica. Quando alguém loga, se tiver aviso novo (que ainda
não viu **hoje**), aparece automaticamente na tela, um de cada vez, com
botão de fechar. Se o aviso continuar ativo, ele **aparece de novo no dia
seguinte** — não é "marcar como lido pra sempre", é "já vi hoje".

**O aviso nunca interrompe quem está no meio de um lançamento.** Ele
respeita um "portão": enquanto o formulário de despesa está aberto sendo
preenchido, o aviso fica seguro. Só recebe uma chance de aparecer bem no
intervalo entre salvar um lançamento e começar o próximo — nunca no meio
da digitação.

## Plano de Contas

Tela **Plano de Contas** (admin/master) — define as categorias de
receita/despesa padronizadas pra toda a igreja. As congregações **não
inventam categoria nova**, só escolhem entre as que a sede cadastrou —
isso é o que permite comparar "quanto todo mundo gastou com energia"
de verdade. Categoria com lançamento já usando não é apagada, só
desativada (histórico nunca some).

## Prestação de contas — workflow real

Deixou de ser um simples "enviou / não enviou". Agora tem status de
verdade:

`ENVIADA` → `EM_ANALISE` → `APROVADA` (ou `PENDENCIA`, com observação da
sede explicando o que falta) → `ENCERRADA`

O dashboard no topo de Prestar Contas (visão da sede) mostra, pra
qualquer mês, os cards 🟢 Aprovadas / 🔵 Em análise / 🟠 Pendência / 🔴
Não enviadas — com a lista de **todas** as congregações, mesmo quem
nunca mandou nada naquele mês.

## Saldo por congregação

`getSaldoPorCongregacao` calcula o saldo acumulado histórico (não só
do ano) de cada congregação — entradas menos saídas desde sempre.
**Atenção**: a soma dos saldos de todas as congregações não significa
que a sede tem esse dinheiro numa conta só — cada uma controla o
próprio caixa.

## Auditoria financeira

Cada lançamento criado/editado/apagado e cada mudança de status de
prestação de contas fica registrado (quem fez, quando, o quê) — visível
no detalhe de cada prestação de contas, na aba "Histórico".

## Consolidado (visão da sede)

Tela **Consolidado** (admin/master) — a pergunta "como está
financeiramente toda a igreja?" respondida em segundos: receita/despesa/
saldo consolidado do mês escolhido, gráfico de evolução dos últimos 6
meses, e um ranking com todas as congregações (receita, despesa, saldo
do período, e a situação da prestação de contas dela). "Saldo
consolidado" é a soma dos saldos — não é dinheiro numa conta só.

## Transferências entre unidades

Tela **Transferências** (admin/master) — repasse de dinheiro entre
qualquer duas unidades (sede ↔ congregação, ou congregação ↔
congregação), com valor, data, motivo e comprovante opcional.

**Importante**: uma transferência **não é uma despesa nem uma receita**
— não aparece nos totais de "quanto entrou/saiu" nem no Consolidado da
organização (porque não é dinheiro novo, só mudando de bolso). Ela só
afeta o **saldo** de cada unidade envolvida (quem manda perde do saldo,
quem recebe ganha) — testei esse comportamento exato e confirmei que o
total consolidado não muda nem um centavo com uma transferência.

## Relatórios exportáveis

- **Excel** — botão "Exportar" em Financeiro (extrato do mês atual, com
  totais) e em Consolidado (ranking por congregação do mês escolhido) —
  gera `.xlsx` de verdade, abre no Excel/Google Sheets/LibreOffice
- **PDF** — botão "PDF" em Consolidado usa a tela de impressão do
  próprio navegador (mesmo mecanismo já usado em Documentos/
  Carteirinha/Certificado) — imprime ou salva como PDF, sem precisar de
  nenhuma biblioteca pesada extra rodando no servidor

## Cobrar congregações atrasadas

Em **Prestar Contas** (visão da sede/admin), o card "Situação por
congregação" mostra quem está com lançamentos de um **mês anterior**
ainda não enviados (o mês corrente não conta — ainda pode estar em
andamento). Marque "Mostrar só inadimplentes" pra filtrar, selecione uma
ou mais, e clique em **"Enviar cobrança"** — isso manda um aviso (mesmo
mecanismo do mural) direto pra quem é daquela(s) congregação(ões),
com uma mensagem de cobrança pré-pronta que você pode editar antes de
enviar.

## Documentos — modelos customizáveis

Tela **Documentos**: escolhe um modelo, busca o membro, preenche os
campos extras (se o modelo pedir), e o documento sai pronto — dados do
membro e da congregação já preenchidos automaticamente, prontos pra
imprimir.

**Admin/master criam os próprios modelos** ("Gerenciar modelos"),
escrevendo o texto com variáveis entre `{{chaves}}`:
- `{{membro.nome}}`, `{{membro.cpf}}`, `{{membro.endereco}}`,
  `{{membro.data_nascimento}}`, `{{membro.data_batismo}}`, etc.
- `{{congregacao.nome}}`, `{{congregacao.endereco}}`, `{{congregacao.pastor}}`
- `{{data_hoje}}`, `{{data_hoje_extenso}}`
- `{{extra.qualquer_nome}}` — campo livre, preenchido na hora de gerar
  (pra informação que não existe no cadastro, tipo "nova igreja de
  destino" numa carta de transferência)

Já vem um modelo pronto, **"Carta de Mudança de Igreja"**, seguindo a
estrutura de 10 seções (remetente, igreja de origem, nova igreja,
motivo, histórico, agradecimento, data, assinatura, declaração) — pode
editar ou criar quantos modelos quiser além dele.

**Carta de mudança recebida**: se um membro chegou transferido de outra
igreja, anexe a carta que ele trouxe na página dele mesmo (Membros → 
abre o membro → "Carta de mudança") — foto ou PDF, até 8MB.

## Lançamento rápido de despesas

No formulário de "Novo lançamento" em Financeiro:

- **Atalhos de um clique** (Dízimo, Oferta, Água, Energia, Internet,
  Material) já preenchem tipo + categoria e vão direto pro campo Valor
- **Enter pula de campo em campo**: Valor → Data → Descrição
- **Enter na Descrição já lança** e prepara automaticamente o próximo —
  tipo, categoria, data, forma de pagamento e congregação continuam
  preenchidos (geralmente se repetem entre lançamentos seguidos), só o
  valor e a descrição ficam limpos, prontos pra digitar de novo

Pra lançar 10 despesas parecidas, dá pra fazer tudo só no teclado, sem
tocar no mouse depois do primeiro atalho.

## Comprovantes de despesa

Cada lançamento financeiro pode ter um comprovante anexado (foto ou PDF,
até 8MB) — clique no ícone de clipe ao lado do lançamento. Os arquivos
ficam guardados em disco, dentro da mesma pasta `data/` que já é o volume
persistente do Docker (`data/comprovantes/`) — **não** ficam salvos no
banco de dados, pra não pesar o SQLite com anos de fotos de nota fiscal.
Isso significa que, em qualquer backup do servidor, é importante incluir
a pasta `data/` inteira (não só o arquivo `.db`).

**Organização das pastas** — automática, por congregação/mês/dia, usando
a data do lançamento (não a data do upload):

```
data/comprovantes/
  assembleia-de-deus-central/
    2026-06/
      08/
        <id-do-lancamento>-<identificador>.jpg
      15/
        ...
  vila-sao-jose/
    2026-06/
      ...
  sede-geral/              ← lançamentos sem congregação vinculada
    2026-06/
      ...
```

**Sobre "escolher a pasta de destino"**: como o sistema roda no servidor
(não no seu computador), não existe uma janela de "Salvar como" — quem
define onde os arquivos ficam de verdade é o `SQLITE_PATH` no `.env` +
o mapeamento de volume no `docker-compose.yml` (ver seção seguinte).

## PIX vinculado ao membro — como funciona

1. Financeiro → Configurar PIX (chave, nome, cidade da igreja) — uma vez só
2. Na página de qualquer membro, "Gerar cobrança PIX pra este membro" —
   escolhe o tipo (dízimo/oferta/etc.) e valor (opcional)
3. Mostra o QR Code pro membro (tela, print, WhatsApp)
4. Quando o PIX cair na conta do banco, confirme em Financeiro → a
   cobrança pendente aparece lá — o sistema já lança automaticamente no
   financeiro **vinculado a esse membro**

## Instalação (primeira vez)

Precisa do Docker Desktop instalado. Dois cliques em **`instalar.bat`**.
O banco de dados é criado sozinho quando o app sobe pela primeira vez —
não precisa fazer nada a mais.

Se quiser criar o banco **sem depender do Docker estar rodando** (por
exemplo, num PC novo, só pra conferir se está tudo certo antes de subir
o container), tem o **`criar-banco.bat`** — precisa só do Node.js
instalado, não do Docker. Veja detalhes na seção "Criar o banco de
dados manualmente" mais abaixo.

## Dados de demonstração (opcional, só pra teste)

Esse ZIP já vem com o banco populado de dados de teste — **~30
congregações, ~900 membros, 6 meses de histórico financeiro realista, e
cultos agendados** — pra você já abrir e ver o sistema "cheio", em vez de
vazio. Alguns meses recentes ficaram de propósito sem prestação de
contas enviada, pra dar pra testar a tela de cobrança de inadimplência.

- Login de cada congregação: usuário `coord_<cidade>_<numero>`, senha
  `teste123` (veja a lista completa em Usuários, já logado como admin)
- **Antes de entregar pra um cliente de verdade**, apague a pasta
  `data/` inteira (ela recria vazia sozinha no próximo `docker compose
  up`) — ou rode `criar-instancia.bat` normalmente, que já nasce vazia
- Pra gerar esses dados de novo (ex.: numa instância nova, só pra
  testar), rode **`popular-dados-teste.bat`**

## Uso do dia a dia

- **`iniciar-gestao-igreja.bat`** — sobe/reinicia
- **`parar-gestao-igreja.bat`** — para

## Criar uma nova instância (novo cliente/igreja)

Pra vender pra uma nova igreja, use **`criar-instancia.bat`**:

1. Pede um nome (ex.: `igreja-central`) e uma porta (ex.: `8090`)
2. Copia todo o sistema pra `instancias\<nome>\`, **totalmente vazio** —
   sem membros, sem eventos, sem financeiro, só o login padrão
   `admin`/`admin123`
3. Gera `.env` próprio com `SESSION_SECRET` único
4. Ajusta o `docker-compose.yml` da cópia (nome do container e porta)
5. **Você ainda precisa preencher `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
   próprios dessa igreja** no `.env` da instância antes de entregar
6. Pergunta se quer subir na hora

Cada instância é 100% independente — dados, membros, financeiro e
configuração isolados.

## O que ainda não foi construído (próximas fases)

- **App do membro (login Google) e Pedidos de Oração** — removidos a
  pedido por enquanto, podem voltar depois
- Confirmação automática do PIX (hoje é manual — tesoureiro confere o
  extrato do banco e confirma; automatizar exige um gateway pago com
  webhook, tipo Mercado Pago/Efí/Asaas — não é uma limitação de código,
  é a necessidade de credenciais reais que só vocês podem contratar)
- Recursos com IA (resumo automático, sugestão de acompanhamento, etc.)

## Segurança e privacidade

- Notas de pastoreio (visitas, aconselhamentos) são visíveis **só** pra
  Pastor Presidente e Pastor Local — nunca aparecem pro próprio membro,
  secretário ou líder
- Pedidos de oração marcados "só liderança" não aparecem no mural público
  do app
- `.env` de cada instância contém segredos reais (SESSION_SECRET, Google
  OAuth) — nunca compartilhe entre instâncias nem envie por e-mail

## Criar o banco de dados manualmente

Normalmente você nem precisa pensar nisso — o banco é criado sozinho
na primeira vez que o app roda (via Docker ou via `npm start`). Mas se
precisar criar/conferir o banco **sem subir o app inteiro** (ex.: um PC
novo, só com Docker instalado e nada mais configurado), tem um script
à parte pra isso.

Precisa só do [Node.js](https://nodejs.org/) (versão LTS) instalado —
não precisa do Docker rodando pra esse passo.

1. Dê duplo clique em **`criar-banco.bat`** — ele instala as
   dependências (só na primeira vez), cria o `.env` a partir do
   `.env.example` se ainda não existir, e monta o banco de dados
   inteiro: as 32 tabelas, o plano de contas padrão, o modelo de carta
   de transferência, os usuários `master`/`admin` iniciais e a licença
   de teste de 30 dias.
2. Pode rodar de novo quantas vezes quiser — não duplica nada.
3. Depois disso, o arquivo fica em `./data/dashboard.db`, pronto pro
   Docker usar (o `docker-compose.yml` já mapeia essa pasta) ou pro
   `npm start` usar direto.

Pelo terminal, sem o `.bat`:

```bash
npm install
npm run criar-banco
```
