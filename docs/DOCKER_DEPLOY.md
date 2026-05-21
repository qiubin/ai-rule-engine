# Docker 部署指南

本文档说明如何使用 Docker 在本地或服务器上部署规则引擎前后端服务。

## 前提条件

- Docker Engine 20.10+
- Docker Compose 2.0+
- 可访问的 MySQL 8 数据库（本机或远程）

## 部署架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   浏览器访问     │────▶│  前端 (Nginx)   │────▶│ 后端 (Spring Boot)│
│  localhost:3001 │     │   端口 80       │     │   端口 8082     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │  MySQL 8        │
                                                │  192.168.2.166  │
                                                └─────────────────┘
```

- 前端 Nginx 将 `/api` 代理到后端服务
- 后端通过环境变量连接外部 MySQL

## 文件说明

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | 编排前后端服务 |
| `rule-engine-server/Dockerfile` | 后端镜像构建（多阶段） |
| `rule-engine-ui/Dockerfile` | 前端镜像构建（Node → Nginx） |
| `rule-engine-ui/nginx.conf` | Nginx 代理配置 |

## 快速部署

### 1. 确认数据库可访问

确保 MySQL 已启动且容器网络能访问到数据库地址（默认 `192.168.2.166:3306`）。

如需使用本机数据库，将 `docker-compose.yml` 中的 `MYSQL_HOST` 改为宿主机的可访问 IP（macOS 可用 `host.docker.internal`）。

### 2. 一键构建并启动

```bash
cd /Users/qiuqiu/Documents/QIUBIN/project/rule-engine

docker-compose up --build -d
```

首次构建需要下载基础镜像并编译项目，耗时约 3-5 分钟。

### 3. 查看服务状态

```bash
# 查看容器运行状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 只看后端日志
docker-compose logs -f backend

# 只看前端日志
docker-compose logs -f frontend
```

### 4. 访问应用

| 服务 | 地址 |
|------|------|
| 前端页面 | http://localhost:3001 |
| 后端 API | http://localhost:8082 |

### 5. 停止服务

```bash
# 停止并保留容器数据
docker-compose stop

# 停止并删除容器
docker-compose down

# 停止并删除容器 + 镜像（彻底清理）
docker-compose down --rmi all
```

## 常用维护命令

### 重启单个服务

```bash
# 只重启后端
docker-compose restart backend

# 只重启前端
docker-compose restart frontend
```

### 更新代码后重新部署

```bash
# 拉取最新代码后，重新构建并启动
docker-compose up --build -d
```

### 进入容器排查问题

```bash
# 进入后端容器
docker exec -it rule-engine-backend sh

# 进入前端容器
docker exec -it rule-engine-frontend sh
```

### 查看后端 JVM 状态

```bash
docker exec rule-engine-backend ps aux | grep java
docker exec rule-engine-backend java -version
```

## 配置说明

### 修改数据库连接

编辑 `docker-compose.yml` 中 `backend` 服务的 `environment`：

```yaml
environment:
  - MYSQL_HOST=你的数据库IP        # 默认 192.168.2.166
  - MYSQL_PORT=3306
  - MYSQL_DB=ruleengine
  - MYSQL_USER=root
  - MYSQL_PASSWORD=你的密码
```

修改后执行：

```bash
docker-compose up -d
```

### 修改端口映射

编辑 `docker-compose.yml` 中 `ports` 部分：

```yaml
frontend:
  ports:
    - "8080:80"    # 将本机 8080 映射到容器 80

backend:
  ports:
    - "9090:8082"  # 将本机 9090 映射到容器 8082
```

### 调整 JVM 参数

编辑 `rule-engine-server/Dockerfile` 中的 `JAVA_OPTS`：

```dockerfile
ENV JAVA_OPTS="-Xms512m -Xmx1024m"
```

或在启动时覆盖：

```bash
docker-compose run -e JAVA_OPTS="-Xms1g -Xmx2g" backend
```

## Apple Silicon (M1/M2/M3) 注意事项

如果拉取镜像时提示 `no match for platform in manifest`，说明某些镜像没有 arm64 版本。

当前已使用以下兼容镜像：
- 构建阶段：`eclipse-temurin:8-jdk`（支持 arm64）
- 运行阶段：`eclipse-temurin:8-jre`（支持 arm64）
- 前端构建：`node:18-alpine`（支持 arm64）
- 前端运行：`nginx:alpine`（支持 arm64）

如仍遇到问题，可强制 x86 模拟（性能较低）：

```bash
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker-compose up --build -d
```

## 故障排查

### 后端启动失败，日志提示数据库连接超时

1. 确认 MySQL 服务已启动
2. 确认容器能访问数据库地址：
   ```bash
   docker exec -it rule-engine-backend sh
   nc -zv 192.168.2.166 3306
   ```
3. macOS 连接本机数据库时，将 `MYSQL_HOST` 改为 `host.docker.internal`

### 前端页面白屏或 API 404

1. 确认后端容器已正常运行：`docker-compose ps`
2. 检查 Nginx 代理配置是否正确：`docker exec rule-engine-frontend cat /etc/nginx/conf.d/default.conf`
3. 浏览器开发者工具查看网络请求是否命中 `http://localhost:3001/api/...`

### 构建缓存导致代码未更新

```bash
# 无缓存重新构建
docker-compose build --no-cache
docker-compose up -d
```

### 容器无法停止

```bash
# 强制停止
docker-compose kill
docker-compose down
```

## 生产环境建议

1. **数据库**：使用外部独立数据库，不要在容器内跑 MySQL
2. **镜像仓库**：构建后推送到私有镜像仓库，生产环境直接拉取运行
3. **健康检查**：在 `docker-compose.yml` 中添加 `healthcheck`
4. **日志收集**：挂载日志卷到宿主机，或使用 ELK/Loki 收集
5. **SSL/TLS**：前端 Nginx 配置 HTTPS 证书
6. **资源限制**：为容器设置 `mem_limit` 和 `cpus`

## 相关文件

- [docker-compose.yml](../docker-compose.yml)
- [rule-engine-server/Dockerfile](../rule-engine-server/Dockerfile)
- [rule-engine-ui/Dockerfile](../rule-engine-ui/Dockerfile)
- [rule-engine-ui/nginx.conf](../rule-engine-ui/nginx.conf)
