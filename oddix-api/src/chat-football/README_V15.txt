ODDIX CHAT V15

Objetivo:
Transformar o Oddix Chat em copiloto de apostas com memória, cache inteligente, match resolver robusto, value bet e streaming-ready.

Arquivos incluídos:
- chat-football.service.ts
- chat-football.controller.ts
- chat-football.module.ts
- chat-football.types.ts
- oddix-data-orchestrator.service.ts
- oddix-llm.service.ts
- conversation-memory.service.ts
- oddix-copilot.service.ts
- streaming.service.ts
- value-bet.service.ts
- match-resolver.service.ts
- odds-cache.service.ts

Principais melhorias:
1. Match Resolver V15
   - limpa termos contextuais: vale entrar, qual mercado, quais odds, o que faria.
   - aliases: Panamá/Panama, Croácia/Croacia/Croatia.
   - prioriza fixtures FlashScore e LIVE acima de NS/cache.

2. Cache V15
   - cache de fixture e richContext com TTL configurável.
   - variáveis: ODDIX_V15_CACHE_TTL_MINUTES.

3. Memória enriquecida
   - lastFixtureId, lastStatus, lastMinute, lastOdds, lastStats, lastValueBet, lastBetSlip.

4. Copilot V15
   - data.v15 com recursos ativos, cache flags e provider priority.

5. Streaming-ready
   - endpoints /chat-football/stream e /chat-football/v15/stream mantidos como pseudo-stream.

Regras de segurança:
- Sem estatísticas oficiais => sem entrada oficial.
- Odds sozinhas não liberam entrada.
- Se provider não for FlashScore, não usa externalId como match_id FlashScore.
- Se tiver rate limit, usa cache quando existir e avisa limitação.

Comandos:
npm run build
git add .
git commit -m "feat: oddix chat v15 match resolver cache and copilot"
git push origin main
