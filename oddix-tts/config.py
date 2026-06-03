# config.py

DEFAULT_CONFIGS = {
    # Server settings
    "PORT": 5050,
    "API_KEY": "oddix_voice_key",  # Pode trocar no .env

    # TTS settings - padrão otimizado para Oddix Brasil
    "DEFAULT_VOICE": "pt-BR-AntonioNeural",
    "DEFAULT_RESPONSE_FORMAT": "mp3",
    "DEFAULT_SPEED": 1.08,
    "DEFAULT_LANGUAGE": "pt-BR",

    # Feature flags
    "REQUIRE_API_KEY": True,
    "REMOVE_FILTER": False,
    "EXPAND_API": True,
    "DETAILED_ERROR_LOGGING": True,
}
