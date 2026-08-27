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

### Formato dos códigos

Novos registros recebem um código curto no formato `XX-1234`, com duas letras
e quatro dígitos sequenciais por tipo:

| Tipo | Prefixo | Exemplo |
|------|---------|---------|
| Agendamento | `AG` | `AG-1265` |
| Comercial | `CR` | `CR-1265` |
| Suporte | `SU` | `SU-1265` |
| Hotel | `HO` | `HO-1265` |
| Reserva de hotel | `RS` | `RS-1265` |

Os códigos antigos continuam sendo aceitos nas consultas de agendamentos e
chamados já existentes.

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
GET   /api/appointments/:id     (ID ou código AG-XXXX)
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

### Hotel

O ambiente Hotel possui unidades, quartos e reservas. Todas as datas usam `YYYY-MM-DD`. `checkIn` é a entrada e `checkOut` é a saída, portanto a data de saída é exclusiva: uma reserva de `10` a `13` não conflita com outra de `13` a `15`.

Nas requisições protegidas, envie:

```http
Content-Type: application/json
x-api-key: SUA_CHAVE
```

Os IDs são UUIDs retornados pela API. O campo `price` representa o preço da diária. Reservas ativas têm status `CONFIRMED`; cancelamentos têm status `CANCELLED`.

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/hotels` | — | Lista unidades e quartos |
| GET | `/api/hotels/:id` | — | Detalha uma unidade |
| POST | `/api/hotels` | ✅ | Cadastra unidade; o código `HO-XXXX` é automático |
| PATCH | `/api/hotels/:id` | ✅ | Atualiza nome, cidade ou estado |
| POST | `/api/hotels/:hotelId/rooms` | ✅ | Cadastra quarto, descrição e preço |
| POST | `/api/hotel-reservations/availability` | — | Consulta um, vários ou todos os quartos |
| GET | `/api/hotel-reservations` | — | Lista reservas para o front |
| GET | `/api/hotel-reservations/:id` | — | Busca por ID ou código |
| POST | `/api/hotel-reservations` | ✅ | Reserva e retorna `pixCode`/`pixLink` |
| PATCH | `/api/hotel-reservations/:id` | ✅ | Altera datas/quarto ou cancela |

#### 1. Listar unidades e quartos

```http
GET /api/hotels
```

Resposta `200`:

```json
[
  {
    "id": "hotel-uuid",
    "code": "HO-1001",
    "name": "Hotel Demo Central",
    "city": "Pouso Alegre",
    "state": "MG",
    "createdAt": "2026-08-26T12:00:00.000Z",
    "updatedAt": "2026-08-26T12:00:00.000Z",
    "rooms": [
      {
        "id": "room-uuid",
        "hotelId": "hotel-uuid",
        "name": "Standard 101",
        "description": "Quarto para duas pessoas com cama queen e Wi-Fi.",
        "price": "249.90",
        "isActive": true,
        "createdAt": "2026-08-26T12:00:00.000Z",
        "updatedAt": "2026-08-26T12:00:00.000Z"
      }
    ]
  }
]
```

#### 2. Consultar uma unidade

```http
GET /api/hotels/hotel-uuid
```

Resposta `200`: retorna o mesmo objeto de uma unidade acima, incluindo `rooms`. Se não existir, retorna `404`:

```json
{ "error": "Unidade de hotel não encontrada." }
```

#### 3. Cadastrar unidade

```http
POST /api/hotels
x-api-key: SUA_CHAVE
Content-Type: application/json
```

Payload:

```json
{
  "name": "Hotel Demo Central",
  "city": "Pouso Alegre",
  "state": "MG"
}
```

Resposta `201`:

```json
{
  "id": "hotel-uuid",
  "code": "HO-1265",
  "name": "Hotel Demo Central",
  "city": "Pouso Alegre",
  "state": "MG",
  "createdAt": "2026-08-26T12:00:00.000Z",
  "updatedAt": "2026-08-26T12:00:00.000Z"
}
```

O `code` é gerado automaticamente. Campos obrigatórios ausentes retornam `400`.

#### 4. Alterar unidade

```http
PATCH /api/hotels/hotel-uuid
x-api-key: SUA_CHAVE
Content-Type: application/json
```

Payload parcial:

```json
{
  "name": "Hotel Demo Centro",
  "city": "Belo Horizonte",
  "state": "MG"
}
```

Resposta `200`: retorna a unidade atualizada sem a lista de quartos. Os campos são opcionais, mas envie ao menos o campo que deseja alterar.

#### 5. Cadastrar quarto

```http
POST /api/hotels/hotel-uuid/rooms
x-api-key: SUA_CHAVE
Content-Type: application/json
```

Payload:

```json
{
  "name": "Deluxe 302",
  "description": "Quarto com varanda, cama king e vista para a cidade.",
  "price": 459.9
}
```

Resposta `201`:

```json
{
  "id": "room-uuid",
  "hotelId": "hotel-uuid",
  "name": "Deluxe 302",
  "description": "Quarto com varanda, cama king e vista para a cidade.",
  "price": "459.90",
  "isActive": true,
  "createdAt": "2026-08-26T12:00:00.000Z",
  "updatedAt": "2026-08-26T12:00:00.000Z"
}
```

`price` deve ser numérico e maior ou igual a zero. Unidade inexistente retorna `404`.

#### 6. Consultar disponibilidade

```json
{
  "hotelId": "hotel-uuid",
  "checkIn": "2026-09-10",
  "checkOut": "2026-09-13",
  "roomIds": ["room-uuid-1", "room-uuid-2"]
}
```

Requisição:

```http
POST /api/hotel-reservations/availability
Content-Type: application/json
```

Envie `roomId` para um quarto, `roomIds` para vários ou omita ambos para consultar todos os quartos ativos da unidade.

Resposta `200`:

```json
{
  "hotelId": "hotel-uuid",
  "checkIn": "2026-09-10",
  "checkOut": "2026-09-13",
  "rooms": [
    {
      "id": "room-uuid-1",
      "hotelId": "hotel-uuid",
      "name": "Standard 101",
      "description": "Quarto para duas pessoas com cama queen e Wi-Fi.",
      "price": "249.90",
      "isActive": true,
      "createdAt": "2026-08-26T12:00:00.000Z",
      "updatedAt": "2026-08-26T12:00:00.000Z",
      "available": true
    }
  ]
}
```

`available: false` significa que existe uma reserva `CONFIRMED` que se sobrepõe ao período. Reservas canceladas não bloqueiam o quarto.

#### 7. Criar reserva

```http
POST /api/hotel-reservations
x-api-key: SUA_CHAVE
Content-Type: application/json
```

Payload:

```json
{
  "hotelId": "hotel-uuid",
  "roomId": "room-uuid",
  "guestName": "Maria Oliveira",
  "email": "maria@email.com",
  "phone": "(35) 99999-2222",
  "checkIn": "2026-09-10",
  "checkOut": "2026-09-13"
}
```

Resposta `201`:

```json
{
  "id": "reservation-uuid",
  "code": "RS-1265",
  "hotelId": "hotel-uuid",
  "roomId": "room-uuid",
  "guestName": "Maria Oliveira",
  "email": "maria@email.com",
  "phone": "(35) 99999-2222",
  "checkIn": "2026-09-10T00:00:00.000Z",
  "checkOut": "2026-09-13T00:00:00.000Z",
  "status": "CONFIRMED",
  "pixCode": "000201HOTEL...",
  "pixLink": "pix://pay?code=000201HOTEL...",
  "createdAt": "2026-08-26T12:00:00.000Z",
  "updatedAt": "2026-08-26T12:00:00.000Z",
  "hotel": { "id": "hotel-uuid", "code": "HO-1001", "name": "Hotel Demo Central", "city": "Pouso Alegre", "state": "MG" },
  "room": { "id": "room-uuid", "name": "Standard 101", "description": "Quarto para duas pessoas com cama queen e Wi-Fi.", "price": "249.90" }
}
```

O `pixCode` e o `pixLink` são valores de demonstração. Conflito de período retorna `409`:

```json
{ "error": "O quarto já está reservado para parte desse período." }
```

#### 8. Listar reservas

```http
GET /api/hotel-reservations
GET /api/hotel-reservations?hotelId=hotel-uuid
GET /api/hotel-reservations?roomId=room-uuid&status=CONFIRMED
GET /api/hotel-reservations?guestName=Maria
```

Todos os filtros são opcionais. `status` aceita `CONFIRMED` ou `CANCELLED`. A resposta `200` é um array com o mesmo formato do objeto de criação, incluindo `hotel`, `room`, `createdAt` e `updatedAt`, ordenado da reserva mais recente para a mais antiga.

#### 9. Consultar reserva

```http
GET /api/hotel-reservations/reservation-uuid
GET /api/hotel-reservations/RS-1265
```

Resposta `200`: retorna uma reserva completa, incluindo hóspede, unidade, quarto, período, status e dados PIX. Reserva inexistente retorna `404`:

```json
{ "error": "Reserva de hotel não encontrada." }
```

#### 10. Alterar ou cancelar reserva

Alterar período:

```http
PATCH /api/hotel-reservations/RS-1265
x-api-key: SUA_CHAVE
Content-Type: application/json
```

Payload para alterar datas:

```json
{
  "checkIn": "2026-09-12",
  "checkOut": "2026-09-15"
}
```

Payload para trocar o quarto:

```json
{ "roomId": "outro-room-uuid" }
```

Payload para cancelar:

```json
{ "status": "CANCELLED" }
```

É possível enviar os três tipos de alteração no mesmo payload. Resposta `200`: retorna a reserva atualizada no formato completo. Período ou quarto em conflito retorna `409`; dados inválidos retornam `400`.

Antes de usar o ambiente, aplique `npx prisma migrate deploy` e regenere o client com `npx prisma generate`.

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
curl http://localhost:3001/api/tickets/SU-1001
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
│   │   ├── generateCode.ts  # Gera códigos curtos XX-1234 sequenciais
│   │   └── validation.ts    # Validação simples de campos obrigatórios
│   ├── app.ts                # Configuração do Express
│   └── server.ts             # Ponto de entrada
├── .env.example
└── package.json
```

## Próximos passos

Depois que o back-end estiver validado, o front-end (painel visual para os
vendedores) vai consumir os endpoints `GET` e `PATCH` listados acima.
