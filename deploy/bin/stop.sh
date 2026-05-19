#!/bin/bash

APP_HOME="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$APP_HOME/bin/app.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "应用未运行"
    exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
    echo "正在停止应用 (PID: $PID)..."
    kill "$PID"
    for i in {1..30}; do
        if ! kill -0 "$PID" 2>/dev/null; then
            echo "已停止"
            rm -f "$PID_FILE"
            exit 0
        fi
        sleep 1
    done
    echo "强制终止..."
    kill -9 "$PID" 2>/dev/null || true
    rm -f "$PID_FILE"
else
    echo "进程已不存在"
    rm -f "$PID_FILE"
fi
