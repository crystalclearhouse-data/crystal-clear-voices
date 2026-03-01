"""
Sophie DevOps Crew — FastAPI service
Runs at http://localhost:8000  (CREW_SERVICE_URL)

Endpoints:
  GET  /          health check
  POST /run       run full crew (smoke test + webhook audit + env audit)
  POST /smoke     run smoke-test task only
  POST /audit     run webhook + env audit tasks only
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from crewai import Agent, Task, Crew, Process
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / "voice-server" / ".env")

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "configs" / "crew.json"

app = FastAPI(title="Sophie DevOps Crew", version="1.0.0")


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    sophie_url: str = os.getenv("SOPHIE_URL", "http://localhost:3001")
    public_url: str = os.getenv("PUBLIC_URL", "")


class RunResponse(BaseModel):
    status: str
    tasks_run: list[str]
    result: str


# ---------------------------------------------------------------------------
# Crew builder
# ---------------------------------------------------------------------------

def load_config() -> Dict[str, Any]:
    with CONFIG_PATH.open("r") as f:
        return json.load(f)


def build_crew(cfg: Dict[str, Any], task_ids: Optional[list[str]] = None) -> Crew:
    agents_by_id: Dict[str, Agent] = {}
    for a in cfg["agents"]:
        agents_by_id[a["id"]] = Agent(
            role=a["role"],
            goal=a["goal"],
            backstory=a.get("backstory", ""),
            allow_delegation=a.get("allow_delegation", False),
            verbose=a.get("verbose", True),
        )

    tasks = []
    for t in cfg["tasks"]:
        if task_ids and t["id"] not in task_ids:
            continue
        tasks.append(
            Task(
                description=t["description"],
                expected_output=t["expected_output"],
                agent=agents_by_id[t["agent_id"]],
                async_execution=t.get("async_execution", False),
            )
        )

    return Crew(
        agents=list(agents_by_id.values()),
        tasks=tasks,
        process=Process.sequential,
        verbose=cfg["crew"].get("verbose", True),
    )


def run_crew(task_ids: Optional[list[str]], inputs: Dict[str, Any]) -> Dict[str, Any]:
    cfg = load_config()
    crew = build_crew(cfg, task_ids=task_ids)
    active_ids = task_ids or [t["id"] for t in cfg["tasks"]]
    result = crew.kickoff(inputs=inputs)
    return {"tasks_run": active_ids, "result": str(result)}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def health():
    return {
        "status": "ok",
        "service": "Sophie DevOps Crew",
        "endpoints": ["POST /run", "POST /smoke", "POST /audit"],
    }


@app.post("/run", response_model=RunResponse)
def run_all(req: RunRequest):
    """Run full crew — smoke test + webhook audit + env audit."""
    try:
        out = run_crew(
            task_ids=None,
            inputs={"sophie_url": req.sophie_url, "public_url": req.public_url},
        )
        return RunResponse(status="completed", **out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/smoke", response_model=RunResponse)
def run_smoke(req: RunRequest):
    """Run smoke-test task only."""
    try:
        out = run_crew(
            task_ids=["smoke_test"],
            inputs={"sophie_url": req.sophie_url, "public_url": req.public_url},
        )
        return RunResponse(status="completed", **out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/audit", response_model=RunResponse)
def run_audit(req: RunRequest):
    """Run webhook + env audit tasks only."""
    try:
        out = run_crew(
            task_ids=["webhook_audit", "env_audit"],
            inputs={"sophie_url": req.sophie_url, "public_url": req.public_url},
        )
        return RunResponse(status="completed", **out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
