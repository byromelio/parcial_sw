# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import ALLOWED_ORIGINS, settings
from app.routers import auth as auth_router
from app.routers import diagramas, classes, atributos, metodo, relacion, realtime 
from app.routers import classes as classes_router
from app.routers import export 
app = FastAPI(title="UML AI Tool API")
print("🚀 ALLOWED_ORIGINS:", ALLOWED_ORIGINS)
cors_origins = ["*"] if settings.DEBUG else ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.get("/health")
def health():
    return {"ok": True}
# 🔹 Ruta raíz (útil en navegador/Render)
@app.get("/")
def root():
    return {"status": "ok", "message": "Backend is running 🚀"}
app.include_router(auth_router.router)

app.include_router(diagramas.router)
app.include_router(classes.router)
app.include_router(atributos.router)
app.include_router(metodo.router)
app.include_router(relacion.router)
app.include_router(export.router)
# Router WebSocket (colaboración en tiempo real)
app.include_router(realtime.router)