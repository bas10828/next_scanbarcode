"""
OTDR Web API — FastAPI
Run: uvicorn otdr_api:app --host 0.0.0.0 --port 8001
"""
import os
import tempfile
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List

from otdr_core import build_pdf

app = FastAPI(title="OTDR Report API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.post("/generate")
async def generate(
    files: List[UploadFile] = File(...),
    project_name: str = Form("OTDR"),
):
    if not files:
        raise HTTPException(400, "No files uploaded")

    sor_files = [f for f in files if f.filename.lower().endswith('.sor')]
    if not sor_files:
        raise HTTPException(400, "No .sor files found")

    tmpdir = tempfile.mkdtemp()
    try:
        saved = []
        for uf in sor_files:
            dest = os.path.join(tmpdir, uf.filename)
            with open(dest, 'wb') as fh:
                shutil.copyfileobj(uf.file, fh)
            saved.append(dest)

        saved.sort()
        output_pdf = os.path.join(tmpdir, f"{project_name}.pdf")

        build_pdf(saved, output_pdf, project_name=project_name)

        safe_name = "".join(c for c in project_name if c.isalnum() or c in (' ', '-', '_')).strip() or "OTDR"
        return FileResponse(
            output_pdf,
            media_type="application/pdf",
            filename=f"{safe_name}.pdf",
            background=None,
        )
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(500, str(e))
