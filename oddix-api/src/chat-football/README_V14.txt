Oddix Chat V14.1 - pacote completo

Arquivos para substituir/adicionar em src/chat-football:

SUBSTITUIR:
- chat-football.module.ts
- chat-football.controller.ts
- chat-football.types.ts
- chat-football.service.ts
- oddix-data-orchestrator.service.ts
- oddix-llm.service.ts

ADICIONAR:
- conversation-memory.service.ts
- streaming.service.ts
- value-bet.service.ts
- oddix-copilot.service.ts

Principais recursos V14.1:
- Memória conversacional extra por sessionId.
- Endpoint /chat-football/stream com resposta em chunks para frontend simular streaming.
- Value Bet Engine com probabilidade implícita, EV e edge.
- Bilhete Oddix V14 no data.v14.betSlip quando houver odds/ticket.
- Copilot metadata em data.v14 sem quebrar o contrato antigo da V13.
- Mantém Match Finder, fixture odds e segurança NO_BET da V13.

Comandos:
npm run build
git add .
git commit -m "feat: oddix chat v14 copilot memory streaming value bet"
git push origin main
