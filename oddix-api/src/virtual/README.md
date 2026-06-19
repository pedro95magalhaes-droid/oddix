# Oddix Virtual V1

Módulo separado para Futebol Virtual Bet365 via RapidAPI.

## Variáveis de ambiente

Adicione no Railway/Render/local:

```env
VIRTUAL_BET365_RAPIDAPI_KEY="sua-chave"
VIRTUAL_BET365_RAPIDAPI_HOST="futebol-virtual-bet3651.p.rapidapi.com"
VIRTUAL_BET365_BASE_URL="https://futebol-virtual-bet3651.p.rapidapi.com"
VIRTUAL_BET365_HOME="bet365"
VIRTUAL_BET365_SPORT_ID=1
```

Também funciona usando `RAPIDAPI_KEY` se você já usa essa variável no projeto.

## Rotas

```txt
GET /virtual/leagues
GET /virtual/upcoming?league=euro
GET /virtual/history?league=euro&limit=100
GET /virtual/patterns?league=euro&limit=300
GET /virtual/top-picks?league=euro&historyLimit=300
GET /virtual/last-updated?league=euro
```

## Importante

No `app.module.ts`, importe:

```ts
import { VirtualModule } from "./virtual/virtual.module";
```

E adicione em `imports`:

```ts
VirtualModule
```

## Aviso

Futebol virtual usa RNG. O Oddix Virtual trabalha com padrões estatísticos e gestão de risco, não com garantia de resultado.
