# Oddix TTS Service

Serviço gratuito de voz para o Oddix usando openai-edge-tts.

## Rodar local

```bash
pip install -r requirements.txt
cp .env.example .env
python server.py
```

Endpoint:

```txt
POST http://localhost:5050/v1/audio/speech
```

Headers:

```txt
Authorization: Bearer oddix_voice_key
Content-Type: application/json
```

Body:

```json
{
  "input": "Rapaziada, estamos perto da confirmação.",
  "voice": "pt-BR-AntonioNeural",
  "response_format": "mp3",
  "speed": 1.08
}
```

## Render

Crie um novo Web Service separado chamado `oddix-tts`.

Variáveis:

```env
API_KEY=oddix_voice_key
PORT=5050
DEFAULT_VOICE=pt-BR-AntonioNeural
DEFAULT_RESPONSE_FORMAT=mp3
DEFAULT_SPEED=1.08
DEFAULT_LANGUAGE=pt-BR
REQUIRE_API_KEY=True
REMOVE_FILTER=False
EXPAND_API=True
DETAILED_ERROR_LOGGING=True
```

No Oddix API coloque:

```env
ODDIX_VOICE_ENABLED=true
ODDIX_TTS_URL=https://SEU-ODDIX-TTS.onrender.com/v1/audio/speech
ODDIX_TTS_API_KEY=oddix_voice_key
ODDIX_TTS_VOICE=pt-BR-AntonioNeural
ODDIX_TTS_SPEED=1.08
```
