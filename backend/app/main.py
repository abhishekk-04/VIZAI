import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database.connection import engine, Base
from app.routes import auth, datasets, dashboards

# Create database tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Intelligent Data Visualization and Analytics API",
    version="1.0.0"
)

# CORS configuration
# Enable localhost:5173 (Vite development server) and standard origins
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(dashboards.router)

@app.get("/")
def read_root():
    return {"message": f"Welcome to the {settings.PROJECT_NAME}. Visit /docs for API documentation."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
