import httpx
import asyncio
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class PipelineExecutor:
    def __init__(self, rule_engine_url: str = "http://localhost:8082"):
        self.rule_engine_url = rule_engine_url.rstrip("/")
        self.execute_url = f"{self.rule_engine_url}/api/v1/rules/execute"

    async def execute(self, definition: Dict[str, Any], initial_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行流水线，支持有 Start 节点的路径模式和无 Start 节点的拓扑模式
        """
        nodes = definition.get("nodes", [])
        edges = definition.get("edges", [])
        
        node_map = {n["id"]: n for n in nodes}
        outgoing_edges = {n["id"]: [] for n in nodes}
        for edge in edges:
            u = edge["source"]
            if u in outgoing_edges:
                outgoing_edges[u].append(edge)

        start_node = next((n for n in nodes if n["type"] == "start"), None)

        if start_node:
            # --- 模式 A: 路径寻址模式 (从 Start 开始) ---
            logger.info("Using Path-based traversal (Start node found)")
            return await self._execute_path_mode(start_node, node_map, outgoing_edges, initial_data)
        else:
            # --- 模式 B: 拓扑排序模式 (全量顺序执行) ---
            logger.info("Using Topological sort (No Start node found)")
            return await self._execute_topological_mode(nodes, edges, node_map, initial_data)

    async def _execute_path_mode(self, start_node, node_map, outgoing_edges, initial_data):
        context = initial_data.copy()
        execution_results = {}
        status = "COMPLETED"
        current_node = start_node
        max_steps = 100
        step_count = 0

        async with httpx.AsyncClient() as client:
            while current_node and current_node["type"] != "end" and step_count < max_steps:
                step_count += 1
                node_id = current_node["id"]
                node_type = current_node["type"]
                next_node_id = None
                
                if node_type == "start":
                    edges_from_here = outgoing_edges.get(node_id, [])
                    if edges_from_here: next_node_id = edges_from_here[0]["target"]
                
                elif node_type == "rule":
                    rule_code = current_node.get("data", {}).get("ruleCode")
                    if rule_code:
                        try:
                            res = await client.post(self.execute_url, params={"ruleCode": rule_code}, json=context, timeout=10.0)
                            res.raise_for_status()
                            result = res.json()
                            execution_results[node_id] = result
                            if result.get("matched"): context[f"result_{rule_code}"] = result
                        except Exception as e:
                            execution_results[node_id] = {"error": str(e)}
                            status = "FAILED"
                            break
                    edges_from_here = outgoing_edges.get(node_id, [])
                    if edges_from_here: next_node_id = edges_from_here[0]["target"]

                elif node_type == "condition":
                    config = current_node.get("data", {}).get("conditionConfig", {})
                    ref_res = execution_results.get(config.get("refNodeId"), {})
                    is_matched = ref_res.get("matched", False)
                    target_handle = "true" if (config.get("expected") == "matched" and is_matched) or (config.get("expected") == "not_matched" and not is_matched) else "false"
                    matched_edge = next((e for e in outgoing_edges.get(node_id, []) if e.get("sourceHandle") == target_handle), None)
                    if matched_edge: next_node_id = matched_edge["target"]

                current_node = node_map.get(next_node_id) if next_node_id else None

        return {"status": status, "node_results": execution_results, "final_context": context, "mode": "path"}

    async def _execute_topological_mode(self, nodes, edges, node_map, initial_data):
        # 经典的拓扑排序实现
        adj = {node["id"]: [] for node in nodes}
        in_degree = {node["id"]: 0 for node in nodes}
        for edge in edges:
            u, v = edge["source"], edge["target"]
            if u in adj and v in adj:
                adj[u].append(v)
                in_degree[v] += 1

        queue = [n["id"] for n in nodes if in_degree[n["id"]] == 0]
        sorted_nodes = []
        while queue:
            u = queue.pop(0)
            sorted_nodes.append(u)
            for v in adj[u]:
                in_degree[v] -= 1
                if in_degree[v] == 0: queue.append(v)

        context = initial_data.copy()
        execution_results = {}
        status = "COMPLETED"

        async with httpx.AsyncClient() as client:
            for node_id in sorted_nodes:
                node = node_map[node_id]
                if node["type"] != "rule": continue
                rule_code = node.get("data", {}).get("ruleCode")
                if not rule_code: continue
                try:
                    res = await client.post(self.execute_url, params={"ruleCode": rule_code}, json=context, timeout=10.0)
                    res.raise_for_status()
                    result = res.json()
                    execution_results[node_id] = result
                    if result.get("matched"): context[f"result_{rule_code}"] = result
                except Exception as e:
                    execution_results[node_id] = {"error": str(e)}
                    status = "FAILED"
                    break
        
        return {"status": status, "node_results": execution_results, "final_context": context, "mode": "topological"}
