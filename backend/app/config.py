import os
from dotenv import load_dotenv

# Load env variables from .env file
load_dotenv()

class Settings:
    PROJECT_NAME: str = "VizAI API"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super_secret_jwt_key_for_vizai_development_12345!")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./vizai.db")
    
    # Upload folder
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    
    # Optional API key for Gemini AI
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()
