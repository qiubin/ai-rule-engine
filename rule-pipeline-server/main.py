from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import json
import os
import logging
from engine.executor import PipelineExecutor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Rule Pipeline Server", description="Workflow Orchestrator for Rule Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = PipelineExecutor()

CONFIG_DIR = "data"
if not os.path.exists(CONFIG_DIR):
    os.makedirs(CONFIG_DIR)

class PipelineDefinition(BaseModel):
    id: str
    name: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


class PipelinePatch(BaseModel):
    """仅更新展示名称（文件 id 不变）"""
    name: str


class DuplicatePipelineRequest(BaseModel):
    source_id: str
    target_id: str
    name: str


@app.get("/api/v1/pipelines")
async def list_pipelines():
    """返回已存流程摘要，按文件修改时间倒序。"""
    items: List[Dict[str, Any]] = []
    for fname in os.listdir(CONFIG_DIR):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(CONFIG_DIR, fname)
        pid = fname[:-5]
        try:
            stat = os.stat(path)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            nodes = data.get("nodes") or []
            edges = data.get("edges") or []
            items.append(
                {
                    "id": pid,
                    "name": (data.get("name") or pid).strip() or pid,
                    "nodeCount": len(nodes),
                    "edgeCount": len(edges),
                    "updatedAt": int(stat.st_mtime * 1000),
                }
            )
        except Exception as e:
            logger.warning("list_pipelines skip %s: %s", fname, e)
    items.sort(key=lambda x: x.get("updatedAt") or 0, reverse=True)
    return {"pipelines": items}

@app.get("/api/v1/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    file_path = os.path.join(CONFIG_DIR, f"{pipeline_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Pipeline not found")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.post("/api/v1/pipelines")
async def save_pipeline(pipeline: PipelineDefinition):
    file_path = os.path.join(CONFIG_DIR, f"{pipeline.id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(pipeline.dict(), f, indent=2, ensure_ascii=False)
    return {"status": "success", "id": pipeline.id}


def _rename_pipeline_file(pipeline_id: str, name: str) -> Dict[str, Any]:
    file_path = os.path.join(CONFIG_DIR, f"{pipeline_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Pipeline not found")
    display = (name or "").strip()
    if not display:
        raise HTTPException(status_code=400, detail="name is required")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["name"] = display
    data["id"] = pipeline_id
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return {"status": "success", "id": pipeline_id, "name": display}


@app.post("/api/v1/pipelines/{pipeline_id}/rename")
async def rename_pipeline(pipeline_id: str, payload: PipelinePatch):
    """重命名（仅改 name），用 POST 兼容仅允许 GET/POST 的网关。"""
    return _rename_pipeline_file(pipeline_id, payload.name)


@app.patch("/api/v1/pipelines/{pipeline_id}")
async def patch_pipeline(pipeline_id: str, payload: PipelinePatch):
    return _rename_pipeline_file(pipeline_id, payload.name)


@app.delete("/api/v1/pipelines/{pipeline_id}")
async def delete_pipeline(pipeline_id: str):
    file_path = os.path.join(CONFIG_DIR, f"{pipeline_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Pipeline not found")
    os.remove(file_path)
    return {"status": "success", "id": pipeline_id}


@app.post("/api/v1/pipelines/duplicate")
async def duplicate_pipeline(req: DuplicatePipelineRequest):
    """复制为新的流程文件；目标编码已存在时返回 400，避免误覆盖。"""
    src_path = os.path.join(CONFIG_DIR, f"{req.source_id}.json")
    dst_path = os.path.join(CONFIG_DIR, f"{req.target_id}.json")
    if not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail="源流程不存在")
    if os.path.exists(dst_path):
        raise HTTPException(status_code=400, detail="目标流程编码已存在")
    with open(src_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["id"] = req.target_id
    data["name"] = (req.name or "").strip() or req.target_id
    with open(dst_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return {"status": "success", "id": req.target_id}


@app.post("/api/v1/pipelines/{pipeline_id}/execute")
async def execute_pipeline(pipeline_id: str, input_data: Dict[str, Any]):
    file_path = os.path.join(CONFIG_DIR, f"{pipeline_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    with open(file_path, "r", encoding="utf-8") as f:
        definition = json.load(f)
    
    try:
        result = await executor.execute(definition, input_data)
        return result
    except Exception as e:
        logger.error(f"Execution error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
