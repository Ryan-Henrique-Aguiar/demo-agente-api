# Guia de negócio para o agente de IA — exames e confirmações

Este documento descreve o comportamento **implementado** na API e as decisões que o agente ou a automação de confirmação precisam tomar. Use-o ao escrever o prompt e configurar as ferramentas. Para exemplos detalhados de HTTP, consulte [EXAMES_API.md](EXAMES_API.md).

## 1. O que é cada agendamento

| Fluxo | Como escolher | Criar | Código | Status inicial |
| --- | --- | --- | --- | --- |
| Consulta médica | Especialidade → médico → horário do médico | `POST /api/appointments` | `AG-...` | `ABERTO` |
| Exame | Tipo de exame → horário daquele tipo | `POST /api/exam-appointments` | `EX-...` | `ABERTO` |

São registros distintos, com endpoints e agendas distintos. **Nunca envie `examTypeId` a `/api/appointments` nem `doctorId`/`specialtyId` a `/api/exam-appointments`.** O código retornado identifica o registro criado; não invente códigos nem use os exemplos deste documento como IDs reais.

Os agendamentos de exames são consultáveis pela API e na opção **Exames** da tela de agendamentos do painel, mas não entram no resumo do dashboard.

## 2. Regras de negócio dos exames

1. **Catálogo atual:** o agente deve consultar `GET /api/exam-types?isActive=true` antes de oferecer opções. Só ofereça tipos presentes na resposta atual. O cadastro pode mudar; os quatro tipos da seed são exemplos, não uma lista permanente.
2. **Tipo escolhido:** guarde o `id` do mesmo objeto que contém o nome escolhido. Cada tipo tem `durationMinutes`, `preparation` opcional, `isActive` e uma grade semanal própria. A duração é configurada no cadastro, entre 5 e 120 minutos em múltiplos de 5; 15 minutos é o padrão quando omitida.
3. **Disponibilidade real:** consulte `GET /api/exam-types/{examTypeId}/availability?from=YYYY-MM-DD&days=7`. `from` é opcional e começa hoje; `days` é de 1 a 30, com padrão 7. A resposta traz `availability`, contendo somente dias com horários livres e seus `slots`. Mostre apenas horários retornados para a **data e o tipo selecionados**. O horário inicial cabe integralmente na faixa da grade. Um horário ocupado por exame não cancelado deixa de aparecer. No dia atual, horários que já passaram também são omitidos.
4. **Dados para criar:** `examTypeId`, `patientName`, `appointmentDate` em `YYYY-MM-DD` e `startTime` em `HH:MM` são obrigatórios. `email` e `phone` são opcionais individualmente, mas **pelo menos um deles** deve ser informado. Se houver email, ele deve ter formato válido. Envie telefone como texto, preservando o DDD; a API não o padroniza. Não envie `endTime`, `code` ou `status`: a API calcula a saída, gera o código e cria o exame como `ABERTO`.
5. **Conflito:** cada tipo aceita um agendamento não cancelado por data e horário inicial. Outro tipo pode ter agenda própria no mesmo horário. A API não impede que o **mesmo paciente** marque exames diferentes ou uma consulta no mesmo horário; o agente deve evitar sobreposição ao combinar compromissos, usando a duração ou o `endTime` retornado.
6. **Preparo:** repasse somente o texto `preparation` cadastrado, quando houver. Ele é uma orientação informativa; não invente jejum ou instrução clínica e encaminhe dúvidas específicas à unidade.
7. **Cancelamento:** `PATCH /api/exam-appointments/{id-ou-codigo}` com `{"status":"CANCELADO"}` libera o horário. O registro fica no histórico e não pode ser reativado; um novo agendamento gera outro código. O PATCH também aceita `notes`.

O backend valida data real e futura, tipo ativo, horário dentro da grade e conflito de horário. A reserva só está concluída depois de resposta **HTTP 201** com o registro criado. A consulta de disponibilidade é uma fotografia do momento; outro paciente pode ocupar o slot antes do POST.

## 3. Fluxo de conversa para marcar um exame

1. **Entenda o pedido.** Confirme que a pessoa quer um exame, e não uma consulta médica. Se houver um pedido médico com nome parecido, localize o tipo pela lista atual; se não houver correspondência segura, peça esclarecimento ou encaminhe à unidade.
2. **Ofereça tipos reais.** Chame `GET /api/exam-types?isActive=true`. Apresente nomes retornados, sem inventar oferta, preço, profissional ou unidade. Guarde o `examTypeId` escolhido.
3. **Escolha data e horário.** Pergunte a preferência, consulte a disponibilidade do tipo e mostre os `slots` da data pedida. Se não houver vagas, ofereça outras datas retornadas ou faça nova consulta. Converta fala como “oito e quinze” para `08:15`, mas aceite o horário somente se estiver na resposta.
4. **Identifique paciente e contato.** Colete o nome do paciente. O contato pode ser outra pessoa, como um responsável; não presuma que o nome da conversa é o paciente. Para permitir a confirmação posterior por WhatsApp, **peça e confirme o telefone de contato** mesmo que a API permita um cadastro somente com email. Use o mesmo telefone confirmado para todos os agendamentos desse contato, se ele concordar. Email pode ficar ausente.
5. **Leia o resumo e peça autorização.** Informe tipo de exame, paciente, data, horário, duração, eventual preparo e telefone de contato. Se a pessoa alterar tipo ou data, descarte a disponibilidade anterior e consulte novamente. Só crie após confirmação explícita dos dados.
6. **Crie uma vez.** Envie `POST /api/exam-appointments` com `x-api-key` da integração. Após HTTP 201, informe o código `EX-...`, data e horário reais da resposta. Não faça nova criação automática se houver timeout ou resposta ambígua: pesquise os registros daquele tipo e data e verifique com cuidado, ou peça revisão humana, para evitar duplicidade.
7. **Se houver mais de um exame:** repita escolha de tipo e disponibilidade para cada registro. Evite horários sobrepostos para a mesma pessoa. Cada exame terá seu próprio `id`, código e status, mesmo que depois receba uma única mensagem de confirmação.

Exemplo de corpo de criação, usando **valores obtidos nas consultas reais**:

```json
{
  "examTypeId": "uuid-retornado-em-exam-types",
  "patientName": "Maria Oliveira",
  "phone": "35999998888",
  "appointmentDate": "YYYY-MM-DD",
  "startTime": "08:15"
}
```

`appointmentDate` acima é um marcador: substitua pela data exata retornada em `availability`. Não envie o marcador à API. O email pode ser acrescentado como `"email":"maria@exemplo.com"` se a pessoa fornecê-lo.

### Ferramentas que o agente precisa

| Finalidade | Método e rota | Chave de API? |
| --- | --- | --- |
| Listar tipos ativos | `GET /api/exam-types?isActive=true` | Não |
| Consultar disponibilidade | `GET /api/exam-types/{id}/availability?from=YYYY-MM-DD&days=7` | Não |
| Criar exame | `POST /api/exam-appointments` | Sim, `x-api-key` |
| Consultar um exame | `GET /api/exam-appointments/{id-ou-EX-...}` | Não |
| Listar exames por data | `GET /api/exam-appointments?date=YYYY-MM-DD` | Não |
| Confirmar, cancelar ou atualizar notas | `PATCH /api/exam-appointments/{id-ou-EX-...}` | Sim, `x-api-key` |

O agente de agendamento não precisa cadastrar tipos nem grades. Isso é uma operação administrativa. Não mostre chaves, IDs internos, payloads nem erros técnicos ao paciente.

## 4. O significado de “confirmado”

- **Consulta médica:** nasce `ABERTO`. `PATCH /api/appointments/{id}` com `{"status":"CONFIRMADO"}` registra a confirmação; `CANCELADO` libera o horário. O PATCH médico usa o **ID do registro** e, nesta versão, não exige `x-api-key`.
- **Exame:** nasce `ABERTO`, com o horário reservado. Após confirmação do paciente, use `PATCH /api/exam-appointments/{id-ou-codigo}` com `{"status":"CONFIRMADO"}`; `CANCELADO` libera o horário. Esse PATCH exige `x-api-key`.
- **Mensagem enviada e resposta do paciente:** a API não possui campos próprios para “lembrete enviado” ou “aguardando resposta”. Marque `CONFIRMADO` apenas quando houver confirmação do paciente; se for necessário auditar envio, entrega ou aceite, guarde esses detalhes na automação ou em um modelo adicional.

Não altere status apenas porque uma mensagem foi enviada. Interprete a resposta do contato e identifique a quais agendamentos ela se refere antes de executar PATCH. Se houver dúvida, peça esclarecimento.

## 5. Uma mensagem para vários agendamentos no mesmo dia

**É possível fazer isso sem mudar o cadastro atual, desde que os registros tenham telefone.** O agrupamento e o envio da mensagem pertencem ao serviço confirmador, não a um endpoint pronto da API. Uma mensagem pode conter vários compromissos; cada compromisso continua sendo um registro independente.

Fluxo recomendado para o confirmador:

1. Para a data de confirmação, busque consultas com `GET /api/appointments?date=YYYY-MM-DD` e exames com `GET /api/exam-appointments?date=YYYY-MM-DD`. Para **pedir confirmação**, inclua consultas e exames `ABERTO`; para um **lembrete** de horários já confirmados, também podem entrar os `CONFIRMADO`. Não envie solicitações de confirmação para registros `CANCELADO`, `CONCLUIDO` ou `EM_ANDAMENTO`. Se a campanha se destinar só a um fluxo, consulte apenas a rota correspondente.
2. Mantenha somente registros com telefone. Normalize no confirmador para uma chave canônica, por exemplo DDI `55` + DDD + número, depois de validar a regra de discagem usada pela operação. O backend armazena o telefone como texto e **não normaliza nem oferece filtro por telefone**. Formatos como `35999998888` e `+55 (35) 99999-8888` precisam virar a mesma chave no confirmador.
3. Agrupe por **telefone normalizado + data do agendamento**. Use a string `appointmentDate` (`YYYY-MM-DD`) armazenada pela API, sem conversão que possa deslocar o dia por fuso horário. Dentro do grupo, ordene por `startTime` e inclua todos os itens com **nome do paciente, tipo de compromisso, nome do exame ou médico, horário e código**. O mesmo telefone pode representar pacientes diferentes; não deduza que são a mesma pessoa.
4. Envie **uma mensagem por grupo**, contendo uma lista clara dos compromissos. Guarde, na automação, os IDs incluídos naquela mensagem para interpretar a resposta sem depender apenas do texto.
5. Se a pessoa confirmar **todos**, processe cada registro `ABERTO`: use `PATCH /api/appointments/{id}` para consultas e `PATCH /api/exam-appointments/{id-ou-codigo}` para exames, ambos com `{"status":"CONFIRMADO"}`. Registros já confirmados não precisam de novo PATCH só por causa do envio. Se cancelar um item, faça PATCH `CANCELADO` **somente nesse item**. Se disser “cancele tudo”, confirme o alcance da solicitação e atualize cada registro selecionado. Se a resposta for ambígua, pergunte qual paciente/código/horário ela quer alterar.

Exemplo de mensagem consolidada:

> Olá! Para 3 de novembro, temos estes agendamentos vinculados a este telefone: Maria Oliveira — hemograma, 08:00, EX-1234; Maria Oliveira — ultrassom, 09:00, EX-1235; João Oliveira — consulta com Dra. Ana, 10:30, AG-1236. Você confirma todos ou quer alterar algum deles?

**Limites atuais:** exame pode ser criado só com email; consulta médica também pode ter telefone ausente. Esses registros não entram numa confirmação baseada em telefone. O backend tampouco garante que dois registros do mesmo número usem a mesma grafia do telefone. Se o envio por telefone for obrigatório para todos, estabeleça o telefone como dado obrigatório no **fluxo do agente** e padronize-o no confirmador; para garantia no banco, seria necessária mudança de validação/modelo. Também não existe bloqueio de múltiplos agendamentos para a mesma pessoa no mesmo dia.

## 6. Recuperação de erros para o agente

| Resultado | Ação de negócio |
| --- | --- |
| `400` | Confira campos, contato, data, formato `YYYY-MM-DD`/`HH:MM` e se o horário pertence à grade. Corrija o dado indicado; não invente outro. |
| `401` | A integração não autenticou. Não solicite a chave ao paciente; encaminhe o problema à operação. |
| `404` | Tipo de exame inexistente ou inativo, ou código não encontrado. Atualize o catálogo e confirme a escolha. |
| `409` | Horário ocupado ou tentativa inválida de reativar exame cancelado. Consulte disponibilidade novamente antes de oferecer alternativas. |
| Timeout ou `5xx` | O resultado é incerto. Não declare sucesso e não repita o POST automaticamente; verifique o registro ou encaminhe para revisão humana. |

## 7. Trecho adaptável ao prompt do agente

> Quando o contato pedir um exame, consulte os tipos ativos da API e peça que escolha um tipo real. Consulte a disponibilidade desse tipo para a data desejada e ofereça somente os horários retornados. Colete nome do paciente e confirme um telefone de contato para a futura mensagem de confirmação; email é opcional. Leia um resumo de tipo, paciente, data, horário, preparo cadastrado e telefone. Após autorização explícita, crie o agendamento em `/api/exam-appointments` uma única vez. Só informe sucesso e código `EX-...` após HTTP 201. O novo registro fica `ABERTO`; quando o paciente confirmar o compromisso, use o PATCH de exames para marcá-lo `CONFIRMADO`. Se houver conflito, atualize os horários; se a resposta for incerta, não repita a criação automaticamente. Para consultas médicas, use o fluxo e os endpoints próprios de consultas.
