from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./responza.db"

    vapi_api_key: str = ""
    vapi_webhook_secret: str = ""
    vapi_phone_number_id: str = ""

    public_base_url: str = ""


settings = Settings()
