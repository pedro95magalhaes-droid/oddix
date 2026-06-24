Oddix Chat V16 Brain/Research Core

Objetivo:
- Melhorar entendimento de perguntas naturais no estilo ChatGPT.
- Corrigir perguntas como "quanto saiu colombia e congo".
- Forçar pesquisa web com múltiplas queries quando a pergunta depende de informação atual.
- Economizar cota usando cache do Research Agent.

Novos serviços:
- oddix-query-cleaner.service.ts
- oddix-research-agent.service.ts

Fluxo:
Usuário -> Query Cleaner -> Brain/Intent -> Research Agent multi-query -> APIs -> DeepSeek -> Resposta.

Testes sugeridos:
- quanto saiu colombia e congo
- tem jogos da copa hoje
- Flamengo x Palmeiras vale entrar?
- noticias do Flamengo hoje
- quais jogos ao vivo?
