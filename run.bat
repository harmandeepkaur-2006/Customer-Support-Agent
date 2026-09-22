@echo off
echo Starting ResolveAI Backend...
if not exist .venv (
  py -m venv .venv
)
call .venv\Scripts\activate
python -m pip install -r requirements.txt
echo ========================================================
echo ResolveAI Server running at: http://localhost:8000
echo ========================================================
python -m uvicorn app:app --reload --host localhost --port 8000



