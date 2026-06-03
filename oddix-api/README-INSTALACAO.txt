ODDIX VOICE + WHATSAPP INTEGRADO

Copie os arquivos nas mesmas pastas do backend:

1) src/whatsapp-web/whatsapp-web.service.ts
2) src/telegram/results-cron.service.telegram.ts
3) src/voice/oddix-voice.service.ts

ENV local do oddix-api:
ODDIX_VOICE_ENABLED=true
ODDIX_TTS_URL=http://localhost:5050
ODDIX_TTS_API_KEY=oddix
ODDIX_TTS_VOICE=pt-BR-AntonioNeural
ODDIX_TTS_SPEED=1.08

No serviço TTS Python:
REQUIRE_API_KEY=False
DEFAULT_VOICE=pt-BR-AntonioNeural

IMPORTANTE:
Se der erro de Nest dependency, importe VoiceModule no módulo onde ResultsCronService está registrado:
import { VoiceModule } from '../voice/voice.module';

imports: [VoiceModule]

Depois rode:
npm run build
