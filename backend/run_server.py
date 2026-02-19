#!/usr/bin/env python
"""Run the FastAPI backend server"""
import uvicorn

if __name__ == "__main__":
    print("🚀 Starting Media Downloader Backend")
    print("   API running at http://0.0.0.0:8001")
    print("   Docs at http://0.0.0.0:8001/docs")
    print("\n   Press Ctrl+C to stop\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True, log_level="info")
