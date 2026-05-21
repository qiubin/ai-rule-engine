#!/bin/bash

# 规则引擎启动脚本
# 使用方式: ./start.sh [backend|frontend|all]
#
# 环境变量:
#   USE_SOCAT=true      强制启用 socat 代理（本地开发连 VPN 数据库时用）
#   USE_SOCAT=false     强制禁用 socat（服务器直连数据库时用）
#   不设置时自动检测: 如果当前机器能直连数据库，则不启用 socat

set -e

RULE_ENGINE_DIR="$(cd "$(dirname "$0")" && pwd)"
SOCAT_PID=""

cleanup() {
    if [ -n "$SOCAT_PID" ] && kill -0 "$SOCAT_PID" 2>/dev/null; then
        kill "$SOCAT_PID" 2>/dev/null
        echo "[socat] 代理已停止"
    fi
}
trap cleanup EXIT

# 检测是否需要 socat 代理
need_socat() {
    # 显式设置
    if [ "${USE_SOCAT:-}" = "true" ]; then
        return 0
    fi
    if [ "${USE_SOCAT:-}" = "false" ]; then
        return 1
    fi

    # 自动检测: 尝试读取 MySQL 握手包验证协议是否正常
    MYSQL_REMOTE_HOST="${MYSQL_REMOTE_HOST:-192.168.2.166}"
    MYSQL_REMOTE_PORT="${MYSQL_REMOTE_PORT:-3306}"

    # 方法1: 用 mysql 客户端直接测试（最准确）
    if command -v mysql &> /dev/null; then
        if mysql -h "$MYSQL_REMOTE_HOST" -P "$MYSQL_REMOTE_PORT" -u root -pzoeddc@2017 -e "SELECT 1" --connect-timeout=3 2>/dev/null | grep -q "1"; then
            echo "[网络] MySQL 客户端可正常连接 $MYSQL_REMOTE_HOST:$MYSQL_REMOTE_PORT，跳过 socat 代理"
            return 1
        fi
    fi

    # 方法2: 读取 MySQL 握手包第一个字节（协议版本应为 0x0a = 10）
    if command -v bash &> /dev/null; then
        local proto_version
        proto_version=$(timeout 3 bash -c "
            exec 3<>/dev/tcp/$MYSQL_REMOTE_HOST/$MYSQL_REMOTE_PORT
            IFS= read -r -d '' -n 1 byte <&3
            printf '%d' \"\$byte
            exec 3<&-
        " 2>/dev/null)
        if [ "$proto_version" = "10" ]; then
            echo "[网络] MySQL 协议握手正常 $MYSQL_REMOTE_HOST:$MYSQL_REMOTE_PORT，跳过 socat 代理"
            return 1
        fi
    fi

    echo "[网络] 本机无法直连数据库 $MYSQL_REMOTE_HOST:$MYSQL_REMOTE_PORT（TCP 可能被放行但 MySQL 协议被拦截），启用 socat 代理"
    return 0
}

start_socat() {
    MYSQL_REMOTE_HOST="${MYSQL_REMOTE_HOST:-192.168.2.166}"
    MYSQL_REMOTE_PORT="${MYSQL_REMOTE_PORT:-3306}"
    SOCAT_PORT="${SOCAT_PORT:-13306}"

    if ! command -v socat &> /dev/null; then
        echo "[socat] 未安装，尝试安装..."
        brew install socat 2>/dev/null && echo "[socat] 安装成功" || echo "[socat] 请手动执行: brew install socat"
        return 1
    fi

    if lsof -ti:"$SOCAT_PORT" &> /dev/null; then
        echo "[socat] 代理已在运行 (localhost:$SOCAT_PORT → $MYSQL_REMOTE_HOST:$MYSQL_REMOTE_PORT)"
    else
        socat TCP-LISTEN:"$SOCAT_PORT",fork,reuseaddr TCP:"$MYSQL_REMOTE_HOST":"$MYSQL_REMOTE_PORT" &
        SOCAT_PID=$!
        echo "[socat] 代理已启动 (localhost:$SOCAT_PORT → $MYSQL_REMOTE_HOST:$MYSQL_REMOTE_PORT) PID=$SOCAT_PID"
    fi

    export MYSQL_HOST=localhost
    export MYSQL_PORT="$SOCAT_PORT"
}

start_backend() {
    echo "========================================"
    echo "正在启动后端服务..."
    echo "========================================"

    if need_socat; then
        start_socat
    fi

    cd "$RULE_ENGINE_DIR/rule-engine-server"

    MVN_CMD="mvn"
    if ! command -v mvn &> /dev/null; then
        if [ -f "./mvnw" ]; then
            MVN_CMD="./mvnw"
        else
            echo "错误: 未找到 Maven 且无 mvnw 脚本，请先安装 Maven 3.9+"
            exit 1
        fi
    fi

    if ! command -v java &> /dev/null; then
        echo "错误: 未找到 Java，请先安装 Java 8+"
        exit 1
    fi

    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2)
    echo "Java 版本: $JAVA_VERSION"

    $MVN_CMD clean install -DskipTests
    $MVN_CMD spring-boot:run &
    echo "后端服务已启动在 http://localhost:8082"
}

start_frontend() {
    echo "========================================"
    echo "正在启动前端服务..."
    echo "========================================"
    cd "$RULE_ENGINE_DIR/rule-engine-ui"

    export NVM_DIR="$HOME/.nvm"
    [ -s "$$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    if ! command -v npm &> /dev/null; then
        echo "错误: 未找到 npm，请先安装 Node.js 18+"
        exit 1
    fi

    NODE_VERSION=$(node -v)
    echo "Node 版本: $NODE_VERSION"

    if [ ! -d "node_modules" ]; then
        echo "正在安装前端依赖..."
        npm install
    fi

    npm run dev &
    echo "前端服务已启动在 http://localhost:3001"
}

case "${1:-all}" in
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    all)
        start_backend
        sleep 10
        start_frontend
        echo ""
        echo "========================================"
        echo "所有服务已启动!"
        echo "前端: http://localhost:3001"
        echo "后端: http://localhost:8082"
        echo "========================================"
        ;;
    *)
        echo "使用方式: $0 [backend|frontend|all]"
        echo "环境变量: USE_SOCAT=true/false 控制是否启用 socat 代理"
        exit 1
        ;;
esac

wait
