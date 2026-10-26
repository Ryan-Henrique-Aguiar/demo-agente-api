# API de exames

Guia de uso dos endpoints de tipos de exames, grade semanal, disponibilidade e agendamentos. A URL base local é `http://localhost:3001/api`.

**Exames e consultas médicas usam endpoints separados.** Exames usam `/exam-appointments` e identificadores `EX-...`; consultas usam `/appointments` e identificadores `AG-...`. O endpoint de consultas exige `doctorId` e `specialtyId`, enquanto o de exames exige `examTypeId`.

## Preparação

No diretório `backend`, aplique a migração e, se desejar os quatro tipos de exemplo, rode a seed:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
npm run dev
```

A nova migração adiciona `ABERTO` como padrão para agendamentos futuros. Os exames existentes mantêm seus status atuais (`CONFIRMADO` ou `CANCELADO`). Ela também mantém o horário ocupado enquanto o exame estiver `ABERTO` ou `CONFIRMADO`.

Defina estas variáveis no terminal usado para os exemplos. Troque a chave pela `API_KEY` configurada no backend. Depois de criar ou listar um exame, copie seu `id` para `EXAM_TYPE_ID`.

```bash
EXAMS_API_URL='http://localhost:3001/api'
EXAMS_API_KEY='sua-chave-de-api'
EXAM_TYPE_ID='uuid-do-tipo-de-exame'
```

Nos endpoints de exames, requisições `GET` são públicas e `POST`, `PATCH` e `DELETE` exigem o cabeçalho `x-api-key`. Envie JSON com `Content-Type: application/json` nas requisições com corpo.

## Fluxo de agendamento

1. Liste os tipos ativos: `GET /exam-types?isActive=true`.
2. Escolha um tipo e consulte `GET /exam-types/:id/availability`.
3. Use uma data e um horário retornados para criar o agendamento em `POST /exam-appointments`.
4. O novo agendamento retorna status `ABERTO`. Guarde o código `EX-...` para consultar e, após a confirmação do paciente, altere para `CONFIRMADO` com `PATCH /exam-appointments/:id`.

Os agendamentos de exames ficam disponíveis na API e na opção **Exames** da tela de agendamentos do painel. Eles não são somados ao dashboard.

## Tipos de exames

### Listar e consultar

```bash
curl -sS "$EXAMS_API_URL/exam-types?isActive=true"
curl -sS "$EXAMS_API_URL/exam-types/$EXAM_TYPE_ID"
```

`GET /exam-types` lista todos os tipos, inclusive os inativos. O filtro `isActive` aceita `true` ou `false`. A resposta inclui `id`, `name`, `durationMinutes`, `preparation`, `isActive` e `schedules`.

### Cadastrar

```bash
curl -sS -X POST "$EXAMS_API_URL/exam-types" \
  -H "x-api-key: $EXAMS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Teste de glicemia",
    "durationMinutes": 15,
    "preparation": "Confirmar as orientações de preparo com a unidade."
  }'
```

`name` é obrigatório e único. `durationMinutes` é opcional, com padrão de 15 minutos; aceita múltiplos de 5 entre 5 e 120. `preparation` é opcional. A resposta é `201` com o tipo criado. A duração é definida na criação e não pode ser editada depois.

### Editar ou inativar

```bash
curl -sS -X PATCH "$EXAMS_API_URL/exam-types/$EXAM_TYPE_ID" \
  -H "x-api-key: $EXAMS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"preparation":"Confirmar o preparo específico antes da visita."}'
```

O `PATCH` aceita `name`, `preparation` e `isActive`, individualmente ou juntos. Para inativar um tipo:

```bash
curl -sS -X PATCH "$EXAMS_API_URL/exam-types/$EXAM_TYPE_ID" \
  -H "x-api-key: $EXAMS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"isActive":false}'
```

Um tipo inativo deixa de oferecer disponibilidade e não aceita novos agendamentos. Seus agendamentos anteriores permanecem consultáveis.

## Grade semanal

Cada tipo tem sua própria grade. A duração do tipo determina os intervalos. Uma faixa de `08:00` a `09:00` com duração de 15 minutos oferece `08:00`, `08:15`, `08:30` e `08:45`.

### Listar faixas

```bash
curl -sS "$EXAMS_API_URL/exam-types/$EXAM_TYPE_ID/schedules"
```

### Adicionar faixa

```bash
curl -sS -X POST "$EXAMS_API_URL/exam-types/$EXAM_TYPE_ID/schedules" \
  -H "x-api-key: $EXAMS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"weekday":"TUESDAY","startTime":"08:00","endTime":"12:00"}'
```

`weekday` aceita `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY` ou `SUNDAY`. Os horários usam `HH:MM`, com `startTime` anterior a `endTime`. Faixas sobrepostas para o mesmo tipo e dia retornam `409`. A resposta `201` contém o `id` da faixa.

### Remover faixa

```bash
EXAM_SCHEDULE_ID='uuid-da-faixa'
curl -sS -i -X DELETE "$EXAMS_API_URL/exam-types/$EXAM_TYPE_ID/schedules/$EXAM_SCHEDULE_ID" \
  -H "x-api-key: $EXAMS_API_KEY"
```

A remoção responde `204` sem corpo. Agendamentos já criados permanecem registrados.

## Disponibilidade

```bash
curl -sS "$EXAMS_API_URL/exam-types/$EXAM_TYPE_ID/availability?days=7"
```

`from` usa `YYYY-MM-DD` e, se omitido, começa hoje. `days` aceita de 1 a 30 e, se omitido, vale 7. Exemplo ilustrativo de resposta:

```json
{
  "examTypeId": "uuid-do-tipo-de-exame",
  "examTypeName": "Teste de glicemia",
  "durationMinutes": 15,
  "preparation": "Confirmar as orientações de preparo com a unidade.",
  "from": "2026-11-03",
  "days": 7,
  "availability": [
    { "date": "2026-11-03", "weekday": "TUESDAY", "slots": ["08:00", "08:15", "08:30"] }
  ]
}
```

Somente dias com horários livres aparecem em `availability`. A API exclui datas e horários passados e horários ocupados por agendamentos não cancelados. Cada tipo comporta um paciente por horário.

## Agendamentos

### Criar

Use `appointmentDate` e `startTime` exatamente como retornados pela disponibilidade. Neste exemplo, o email é omitido:

```bash
curl -sS -X POST "$EXAMS_API_URL/exam-appointments" \
  -H "x-api-key: $EXAMS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "examTypeId": "uuid-do-tipo-de-exame",
    "patientName": "Maria Oliveira",
    "phone": "(35) 99999-2222",
    "appointmentDate": "2026-11-03",
    "startTime": "08:15"
  }'
```

Substitua o `examTypeId` e escolha data e horário futuros retornados na consulta. `examTypeId`, `patientName`, `appointmentDate` e `startTime` são obrigatórios. `email` é opcional; informe **telefone ou email** para contato. Se informado, o email deve ter formato válido. A resposta `201` inclui `id`, código `EX-1001`, `endTime` calculado, `status: "ABERTO"` e os dados do tipo de exame. A criação não confirma o comparecimento do paciente.

O tipo deve estar ativo e o horário deve caber na grade. Se outro agendamento ocupar o mesmo tipo, data e início, a API responde `409`.

### Listar e consultar

```bash
curl -sS "$EXAMS_API_URL/exam-appointments"
curl -sS "$EXAMS_API_URL/exam-appointments?examTypeId=$EXAM_TYPE_ID&date=2026-11-03&status=ABERTO"
curl -sS "$EXAMS_API_URL/exam-appointments/EX-1001"
```

Os filtros `examTypeId`, `date` e `status` são opcionais. A consulta individual aceita o `id` ou o código `EX-...`. Os status possíveis são **`ABERTO`**, **`CONFIRMADO`** e **`CANCELADO`**.

### Alterar status ou notas (PATCH)

O endpoint para mudar o status de um exame é `PATCH /api/exam-appointments/:id`. Aceita o `id` ou o código `EX-...`. Para confirmar um agendamento `ABERTO`:

```bash
curl -sS -X PATCH "$EXAMS_API_URL/exam-appointments/EX-1001" \
  -H "x-api-key: $EXAMS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"status":"CONFIRMADO","notes":"Paciente orientado sobre o preparo."}'
```

Para cancelar e liberar o horário para um novo agendamento:

```bash
curl -sS -X PATCH "$EXAMS_API_URL/exam-appointments/EX-1001" \
  -H "x-api-key: $EXAMS_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"status":"CANCELADO"}'
```

Um agendamento `ABERTO` ou `CONFIRMADO` ocupa o horário. Um agendamento cancelado não pode ser reativado; crie outro para reservar novamente. O `PATCH` altera somente status e notas, não data nem horário.

## Consulta médica: confirmação em endpoint próprio

Consultas são criadas em `POST /api/appointments`, com status inicial `ABERTO`. Para marcar uma consulta como confirmada, use o `id` retornado pela API:

```bash
MEDICAL_APPOINTMENT_ID='uuid-do-agendamento-medico'
curl -sS -X PATCH "$EXAMS_API_URL/appointments/$MEDICAL_APPOINTMENT_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"CONFIRMADO"}'
```

O mesmo `PATCH /api/appointments/:id` aceita os outros status de consulta: `ABERTO`, `EM_ANDAMENTO`, `CONCLUIDO` e `CANCELADO`. Uma consulta `CONFIRMADO` continua ocupando o horário do médico na disponibilidade. O endpoint de consulta médica é distinto do endpoint de exames e, no estado atual desta API, seu `PATCH` não exige `x-api-key`.

## Respostas de erro

| HTTP | Quando ocorre |
|------|--------------|
| `400` | Campo ausente, formato inválido, data passada, horário fora da grade ou parâmetro de consulta inválido |
| `401` | Chave ausente ou diferente da `API_KEY` configurada |
| `404` | Tipo, faixa ou agendamento não encontrado; tipo inativo na consulta de disponibilidade/criação |
| `409` | Nome duplicado, faixa sobreposta, horário ocupado ou tentativa de reativar agendamento cancelado |

O corpo de erro segue o formato `{"error":"mensagem"}`. O preparo cadastrado é informativo; confirme orientações clínicas específicas com a unidade responsável.
