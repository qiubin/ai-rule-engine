#!/bin/bash
set -e

# 规则引擎一键部署脚本（服务器端执行）
# 使用方式：把 deploy/ 目录上传到服务器后执行此脚本

APP_NAME="rule-engine"
APP_HOME="/opt/$APP_NAME"
CURRENT_USER=$(whoami)

echo "========================================"
echo "规则引擎部署脚本"
echo "========================================"

# 1. 检查环境
check_env() {
    echo "[1/5] 检查环境..."

    if ! command -v java &> /dev/null; then
        echo "错误: 未安装 Java，请先安装 Java 8+"
        exit 1
    fi

    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2)
    echo "  Java: $JAVA_VERSION"

    if ! command -v mysql &> /dev/null; then
        echo "警告: 未找到 MySQL 客户端，请确认 MySQL 已安装"
    else
        echo "  MySQL: 已安装"
    fi
}

# 2. 创建目录和权限
setup_dirs() {
    echo "[2/5] 创建目录..."
    sudo mkdir -p "$APP_HOME" || true
    sudo mkdir -p "$APP_HOME/logs" || true

    # 如果当前用户不是 root，检查是否有权限
    if [ "$CURRENT_USER" != "root" ]; then
        echo "  当前用户: $CURRENT_USER"
        echo "  提示: 建议使用独立用户运行（如 ruleengine）"
    fi
}

# 3. 复制文件
copy_files() {
    echo "[3/5] 复制文件..."
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

    cp "$SCRIPT_DIR/rule-engine-server-1.0.0-SNAPSHOT.jar" "$APP_HOME/"
    cp -r "$SCRIPT_DIR/bin" "$APP_HOME/"
    # 复制 config 下除 env.sh 之外的文件，不覆盖已有的数据库密码配置
    mkdir -p "$APP_HOME/config"
    for f in "$SCRIPT_DIR/config/"*; do
        [ "$(basename "$f")" = "env.sh" ] && [ -f "$APP_HOME/config/env.sh" ] && continue
        cp -r "$f" "$APP_HOME/config/"
    done
    cp -r "$SCRIPT_DIR/frontend" "$APP_HOME/"

    chmod +x "$APP_HOME/bin/start.sh"
    chmod +x "$APP_HOME/bin/stop.sh"

    echo "  文件已复制到 $APP_HOME"
}

# 4. 配置环境变量
setup_env() {
    echo "[4/5] 配置环境..."
    ENV_FILE="$APP_HOME/config/env.sh"

    if [ ! -f "$ENV_FILE" ]; then
        echo "错误: 未找到 $ENV_FILE"
        exit 1
    fi

    # 提示用户修改密码
    if grep -q "your_password" "$ENV_FILE"; then
        echo "  ⚠️  请编辑 $ENV_FILE 修改数据库密码"
        echo "     vi $ENV_FILE"
    fi

    echo "  环境配置文件: $ENV_FILE"
}

# 5. 安装 systemd 服务
install_service() {
    echo "[5/5] 安装 systemd 服务..."
    SERVICE_SRC="$APP_HOME/config/rule-engine.service"
    SERVICE_DST="/etc/systemd/system/rule-engine.service"

    if [ -f "$SERVICE_SRC" ]; then
        sudo cp "$SERVICE_SRC" "$SERVICE_DST"
        sudo sed -i "s|/opt/rule-engine|$APP_HOME|g" "$SERVICE_DST"
        sudo systemctl daemon-reload
        echo "  服务已安装: rule-engine"
        echo "  启动: sudo systemctl start rule-engine"
        echo "  停止: sudo systemctl stop rule-engine"
        echo "  自启: sudo systemctl enable rule-engine"
    fi
}

# 6. 输出结果
show_result() {
    echo ""
    echo "========================================"
    echo "部署完成"
    echo "========================================"
    echo "安装目录: $APP_HOME"
    echo "启动命令: $APP_HOME/bin/start.sh"
    echo "停止命令: $APP_HOME/bin/stop.sh"
    echo "日志目录: $APP_HOME/logs/"
    echo ""
    echo "前端静态文件: $APP_HOME/frontend/"
    echo "（可使用 Nginx 指向此目录，或 Python 临时服务:"
    echo "  python3 -m http.server 3001 --directory $APP_HOME/frontend）"
    echo ""
    echo "API 地址: http://服务器IP:8082"
    echo ""
    echo "⚠️  请先确认 config/env.sh 中的数据库配置正确后再启动"
}

# 主流程
check_env
setup_dirs
copy_files
setup_env
install_service
show_result
