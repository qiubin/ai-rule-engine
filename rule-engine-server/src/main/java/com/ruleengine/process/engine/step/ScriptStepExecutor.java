package com.ruleengine.process.engine.step;

import com.fasterxml.jackson.databind.JsonNode;
import com.ruleengine.process.engine.ExecutionContext;
import com.ruleengine.process.engine.StepExecutor;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;

import javax.script.Bindings;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import java.util.Map;

@Component
public class ScriptStepExecutor implements StepExecutor {

    private final SpelExpressionParser spelParser = new SpelExpressionParser();

    @Override
    public String getNodeType() {
        return "SCRIPT_TASK";
    }

    @Override
    public Object execute(String nodeId, JsonNode nodeData, JsonNode config, ExecutionContext context) {
        if (config == null) {
            throw new RuntimeException("SCRIPT_TASK 节点未配置 config: " + nodeId);
        }

        String scriptType = config.has("scriptType") ? config.get("scriptType").asText() : "spel";
        String script = config.has("script") ? config.get("script").asText() : null;

        if (script == null || script.isEmpty()) {
            throw new RuntimeException("SCRIPT_TASK 节点未配置 script: " + nodeId);
        }

        if ("groovy".equalsIgnoreCase(scriptType)) {
            return executeGroovy(script, context);
        } else if ("spel".equalsIgnoreCase(scriptType)) {
            return executeSpel(script, context);
        } else {
            throw new RuntimeException("SCRIPT_TASK 不支持的 scriptType: " + scriptType + ", nodeId=" + nodeId);
        }
    }

    private Object executeSpel(String script, ExecutionContext context) {
        try {
            StandardEvaluationContext evalContext = new StandardEvaluationContext();
            for (Map.Entry<String, Object> entry : context.getVariables().entrySet()) {
                evalContext.setVariable(entry.getKey(), entry.getValue());
            }
            return spelParser.parseExpression(script).getValue(evalContext);
        } catch (Exception e) {
            throw new RuntimeException("SpEL 脚本执行失败: " + script, e);
        }
    }

    private Object executeGroovy(String script, ExecutionContext context) {
        try {
            ScriptEngineManager manager = new ScriptEngineManager();
            ScriptEngine engine = manager.getEngineByName("groovy");
            if (engine == null) {
                throw new RuntimeException("Groovy ScriptEngine 不可用，请确认项目依赖包含 groovy");
            }
            Bindings bindings = engine.createBindings();
            for (Map.Entry<String, Object> entry : context.getVariables().entrySet()) {
                bindings.put(entry.getKey(), entry.getValue());
            }
            return engine.eval(script, bindings);
        } catch (Exception e) {
            throw new RuntimeException("Groovy 脚本执行失败: " + script, e);
        }
    }
}
