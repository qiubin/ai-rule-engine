import requests
import json
import time
import sys

# 配置信息
PIPELINE_SERVER_URL = "http://localhost:8001"

def test_pipeline(pipeline_id):
    print(f"🚀 准备测试流水线: {pipeline_id}")
    
    # 模拟患者数据
    test_patient = {
        "diagName": "房颤, 高血压",
        "opOperName": "瓣膜置换术",
        "age": 76,
        "bleeding_history": "无"
    }
    
    url = f"{PIPELINE_SERVER_URL}/api/v1/pipelines/{pipeline_id}/execute"
    
    try:
        start_time = time.time()
        print(f"📡 正在发送请求到: {url}...")
        
        response = requests.post(url, json=test_patient, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        duration = time.time() - start_time
        
        print("\n✅ 执行成功！")
        print(f"⏱️  耗时: {duration:.2f} 秒")
        print("📊 执行结果摘要:")
        print(f"   状态: {result.get('status')}")
        
        # 打印节点执行详情
        node_results = result.get("node_results", {})
        print(f"   执行节点数: {len(node_results)}")
        for node_id, res in node_results.items():
            matched = res.get("matched", False)
            print(f"     - 节点 {node_id}: {'命中 ✅' if matched else '未命中 ❌'}")
            if matched:
                print(f"       结果内容: {json.dumps(res.get('results', []), ensure_ascii=False, indent=2)}")

    except requests.exceptions.ConnectionError:
        print("❌ 错误: 无法连接到流程引擎，请确保 rule-pipeline-server 已启动 (Port 8001)")
    except Exception as e:
        print(f"❌ 执行失败: {str(e)}")

if __name__ == "__main__":
    pid = "heart_failure_flow"
    if len(sys.argv) > 1:
        pid = sys.argv[1]
    test_pipeline(pid)
