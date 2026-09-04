from pathlib import Path

import uvicorn

_backend = Path(__file__).resolve().parent

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        app_dir=str(_backend),
        reload_dirs=[str(_backend)],
        reload_includes=[".env"],
    )
