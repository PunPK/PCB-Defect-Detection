from src.app import app

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        workers=1,
        ws_ping_interval=30,
        ws_ping_timeout=30,
    )
