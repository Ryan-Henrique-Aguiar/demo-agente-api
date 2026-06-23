# Agente Demo — Backend

API REST que recebe os dados simulados pelo agente de IA (via WhatsApp) nos
3 fluxos de demonstração — **Agendamento**, **Comercial** e **Suporte** — e
os persiste em um banco PostgreSQL, para que um painel (front-end) exiba
tudo de forma visual aos vendedores.

## Stack

- Node.js + TypeScript
- Express 5
- Prisma ORM
- PostgreSQL

## Pré-requisitos

- Node.js 18+ instalado
- PostgreSQL rodando localmente (ou um banco na nuvem, ex: Neon, Supabase, Railway)

## Passo a passo — primeira vez

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo e edite com seus dados reais:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
DATABASE_URL="postgresql://USUARIO:SENHA@localhost:5432/leucotron_demo?schema=public"
PORT=3001
API_KEY="escolha-uma-chave-secreta-aqui"
CORS_ORIGIN="http://localhost:5173"
```

> `API_KEY` é a chave que o agente de IA (ou a automação que conecta o
> WhatsApp à API, ex: n8n/Make) deve enviar no header `x-api-key` em toda
> requisição de criação de registro.

### 3. Criar o banco e gerar o Prisma Client

Se o banco `leucotron_demo` ainda não existe, crie-o no Postgres
(`createdb leucotron_demo` ou via alguma ferramenta gráfica).

Depois, rode as migrations (isso cria as tabelas) e gera o client:

```bash
npx prisma migrate dev --name init
```

> Esse comando já roda o `prisma generate` automaticamente. Caso precise
> gerar o client de novo sem criar uma nova migration, use
> `npm run prisma:generate`.

### 4. (Opcional) Popular com dados fictícios de exemplo

```bash
npx prisma db seed
```

Isso cria 2 registros de exemplo em cada tabela, só para a tela não
aparecer vazia na primeira vez.

### 5. Subir o servidor em modo desenvolvimento

```bash
npm run dev
```

A API sobe em `http://localhost:3001` (ou na porta definida em `PORT`).
Teste com:

```bash
curl http://localhost:3001/health
```

## Visualizar os dados sem precisar do front-end ainda

```bash
npm run prisma:studio
```

Abre uma interface visual (Prisma Studio) em `http://localhost:5555`
para ver e editar os dados das tabelas diretamente.

## Endpoints disponíveis

Todos os endpoints de **criação** (`POST`) exigem o header:

```
x-api-key: SUA_CHAVE_DEFINIDA_NO_ENV
```

Os endpoints de **leitura** (`GET`) e **atualização de status** (`PATCH`)
não exigem a chave, pois serão consumidos diretamente pelo front-end do
painel do vendedor.

---

### 📅 Agendamento

## Fluxo do agendamento médico (agente de IA)

1. `GET /api/specialties` — lista especialidades
2. Paciente escolhe especialidade
3. `GET /api/doctors?specialtyId=ID` — lista médicos da especialidade
4. Paciente escolhe médico
5. `GET /api/doctors/:id/availability?from=YYYY-MM-DD&days=7` — slots disponíveis
6. Paciente escolhe data e horário
7. `POST /api/appointments` — confirma o agendamento

---

## Endpoints — Agendamento Médico

### Especialidades

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | /api/specialties | — | Lista especialidades ativas |
| GET | /api/specialties/:id | — | Detalhe + médicos |
| POST | /api/specialties | ✅ | Cria especialidade |
| PATCH | /api/specialties/:id | ✅ | Atualiza nome/status |
| DELETE | /api/specialties/:id | ✅ | Inativa especialidade |

### Médicos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | /api/doctors | — | Lista (filtros: specialtyId, isActive) |
| GET | /api/doctors/:id | — | Detalhe + grade semanal |
| POST | /api/doctors | ✅ | Cria médico |
| PATCH | /api/doctors/:id | ✅ | Atualiza dados/inativa |
| DELETE | /api/doctors/:id | ✅ | Inativa médico |

### Grade semanal

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | /api/doctors/:id/schedules | — | Lista grade ativa |
| POST | /api/doctors/:id/schedules | ✅ | Adiciona faixa |
| PATCH | /api/doctors/:id/schedules/:sid | ✅ | Edita faixa |
| DELETE | /api/doctors/:id/schedules/:sid | ✅ | Remove faixa |

Payload:
```json
{ "weekday": "MONDAY", "startTime": "08:00", "endTime": "12:00" }
```

weekday: MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY

### Disponibilidade

```
GET /api/doctors/:id/availability?from=2026-06-22&days=7
```

Retorna dias e slots livres de 30 min, descontando agendamentos ABERTO/EM_ANDAMENTO.

### Agendamentos

```
POST  /api/appointments         (auth)
GET   /api/appointments         (filtros: status, doctorId, specialtyId, date)
GET   /api/appointments/:id     (ID ou AGD-XXXX)
PATCH /api/appointments/:id     (status, notes)
```

Payload de criação:
```json
{
  "patientName": "João da Silva",
  "email": "joao@email.com",
  "phone": "(35) 99999-1111",
  "specialtyId": "uuid",
  "doctorId": "uuid",
  "appointmentDate": "2026-07-07",
  "startTime": "09:00",
  "reason": "Consulta de rotina"
}
```

Validações automáticas: médico ↔ especialidade, horário na grade, conflito de slot, data futura.

---
```

**Atualizar status/notas** (usado pelo front)

```bash
curl -X PATCH http://localhost:3001/api/appointments/ID_DO_REGISTRO \
  -H "Content-Type: application/json" \
  -d '{ "status": "CONCLUIDO" }'
```

---

### 💼 Comercial

**Criar oportunidade** (chamado pelo agente de IA)

```bash
curl -X POST http://localhost:3001/api/opportunities \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE" \
  -d '{
    "contactName": "João Silva",
    "company": "Alfa Energia",
    "email": "joao@email.com",
    "phone": "(35) 99999-9999",
    "need": "PABX em nuvem e atendimento omnichannel",
    "hasPabx": true,
    "highVolume": true,
    "digitalChannels": "WhatsApp e telefone"
  }'
```

{
    "contactName": "{contactName}",
    "company": "{company}",
    "email": "{email}",
    "phone": "{phone}",
    "need": "{need}",
    "hasPabx": {hasPabx},
    "highVolume": {highVolume},
    "digitalChannels": "{digitalChannels}"
  }

**Listar oportunidades**

```bash
curl http://localhost:3001/api/opportunities
```

---

### 🛟 Suporte

**Abrir chamado** (chamado pelo agente de IA)

```bash
curl -X POST http://localhost:3001/api/tickets \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE" \
  -d '{
    "name": "João Silva",
    "company": "Alfa Energia",
    "email": "joao@email.com",
    "requesterType": "CLIENTE",
    "product": "PABX em nuvem",
    "problem": "ramais sem completar chamadas externas"
  }'
```
{
	"name": "{name}",
   "company": "{company}",
   "email": "{email}",
	"phone":"{phone}",
   "requesterType": "{requesterType}",
   "product": "{product}",
   "problem": "{problem}"
}

> O campo `priority` é opcional. Se omitido, a API infere uma prioridade
> simples a partir de palavras-chave na descrição do problema.

**Consultar chamado por código** (fluxo "Suporte — Consultar chamado")

```bash
curl http://localhost:3001/api/tickets/SUP-1001
```

**Listar chamados**

```bash
curl http://localhost:3001/api/tickets
curl http://localhost:3001/api/tickets?status=ABERTO&priority=ALTA
```

---

### 📊 Dashboard (resumo geral)

Útil para a tela inicial do painel mostrar números rápidos.

```bash
curl http://localhost:3001/api/dashboard/summary
```

---

## Status possíveis (todos os fluxos)

```
ABERTO | EM_ANDAMENTO | CONCLUIDO | CANCELADO
```

## Prioridades de chamado (apenas Suporte)

```
BAIXA | MEDIA | ALTA | URGENTE
```

## Tipos de solicitante (apenas Suporte)

```
CLIENTE | CONCESSIONARIA
```

## Estrutura do projeto

```
backend/
├── prisma/
│   ├── schema.prisma      # Definição das tabelas e enums
│   └── seed.ts             # Dados fictícios iniciais
├── src/
│   ├── lib/
│   │   └── prisma.ts        # Singleton do Prisma Client
│   ├── middlewares/
│   │   └── apiKeyAuth.ts    # Autenticação simples por API key
│   ├── routes/
│   │   ├── appointments.ts  # Fluxo 1 — Agendamento
│   │   ├── opportunities.ts # Fluxo 2 — Comercial
│   │   ├── tickets.ts       # Fluxo 3 — Suporte
│   │   └── dashboard.ts     # Resumo/contadores
│   ├── utils/
│   │   ├── generateCode.ts  # Gera códigos AGD-/CRM-/SUP- sequenciais
│   │   └── validation.ts    # Validação simples de campos obrigatórios
│   ├── app.ts                # Configuração do Express
│   └── server.ts             # Ponto de entrada
├── .env.example
└── package.json
```

## Próximos passos

Depois que o back-end estiver validado, o front-end (painel visual para os
vendedores) vai consumir os endpoints `GET` e `PATCH` listados acima.
