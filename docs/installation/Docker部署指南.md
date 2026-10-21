# Docker 部署指南：首次部署、更新与蓝绿发布

本文覆盖三种场景，命令可直接复制执行。凡涉及服务器实际拓扑的部分，都先给出只读确认命令，确认后再动手。

## 动手前必读

| # | 事故 | 后果 | 规避 |
| --- | --- | --- | --- |
| 1 | 执行 `docker compose down -v` | **删除数据卷**，数据库全空 | 停服务只用 `down`，永远不加 `-v` |
| 2 | 换了目录跑 compose | 卷名跟着项目名走，挂到空卷，站点正常但数据「全没了」 | 固定部署目录，或用 `COMPOSE_PROJECT_NAME` 锁定 |
| 3 | 以为 `docker load` 会更新线上 | 运行中的容器不会自动换镜像 | 必须重建容器（见第三节） |
| 4 | 不带服务名执行 `docker compose up -d` | 作用于文件内**所有**服务，可能连 Postgres / 反代一起重建 | 始终带上服务名，并加 `--no-deps` |
| 5 | 改了 `web/src` 就重启容器 / 刷新页面 | 前端已 `//go:embed` 进二进制，改代码不重建镜像等于没改 | 前端变更必须重新构建镜像 |
| 6 | 用 `docker exec ... psql -i` | `-i` 属于 `docker exec`，写在 psql 后面报 `invalid option -- 'i'` | 用 `-c "单行 SQL"`，需要 stdin 时才用 `docker exec -i` |

***

## 一、先确认你的拓扑

| 拓扑 | 对外入口 | API 是否发布宿主端口 | 典型用途 |
| --- | --- | --- | --- |
| **A. 直连** | `http://服务器IP:3000` | 是，`ports: "3000:3000"` | 内网、测试、暂无域名 |
| **B. 反代（生产）** | `https://你的域名`，反代持有 80/443 | 否，只在 Docker 网络内 | 对外提供服务 |

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

- 出现 `0.0.0.0:3000->3000/tcp` → **拓扑 A**
- 只出现 `3000/tcp`（没有 `->`）→ **拓扑 B**，前面必然有一个反代容器（Caddy / Nginx）

拓扑 B 的典型输出：

```
jingyu-api        3000/tcp                      ← 无宿主端口
jingyu-caddy      0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
jingyu-postgres   5432/tcp                      ← 无宿主端口，安全
jingyu-redis      6379/tcp                      ← 无宿主端口，安全
```

**关键概念**：容器内永远监听 `3000`；对外端口只由 compose 的 `ports` 决定；`Dockerfile` 里的 `EXPOSE 3000` 仅是文档声明，**不影响端口映射**，因此同一镜像可以用 `3000:3000`，也可以用 `3030:3000`。

***

## 二、首次部署

### 2.1 准备 `.env`（四个密钥）

`docker-compose.yml` 中四个变量写作 `${VAR:?...}`，**缺任意一个 compose 直接报错退出**，不会用空密码起容器。

```bash
cd <部署目录>
cp .env.example .env
vi .env
```

| 变量 | 用途 | 生成方式 |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | Postgres 密码，同时拼进 `SQL_DSN` | `openssl rand -hex 12` |
| `REDIS_PASSWORD` | Redis `--requirepass`，同时拼进连接串 | `openssl rand -hex 12` |
| `SESSION_SECRET` | 会话签名密钥 | `openssl rand -hex 32` |
| `CRYPTO_SECRET` | 任务产物下载链接的 HMAC 密钥 | `openssl rand -hex 32` |

⚠️ 两个坑：

- `SESSION_SECRET` **不能**写成字面量 `random_string`，代码里对该值 `log.Fatal`，容器起不来。
- 这四个值**只用于 compose 变量替换，不会被注入容器**。容器真正拿到的环境变量是 compose `environment:` 里显式列出的那几项。

### 2.2 固定 compose 项目名（决定数据卷归属）

项目名默认取**目录名**，命名卷完整名字是 `<项目名>_pg_data`。因此 `/opt/jingyu-api` 和 `/opt/jjingyu-api` 挂的是两个不同的卷。

```bash
# 看当前项目名与卷名
docker compose config --format json | python3 -c \
  'import json,sys; d=json.load(sys.stdin); print("project:", d["name"]); print("volume :", d["volumes"]["pg_data"]["name"])'

# 已有数据时，核对线上真实卷名
docker volume ls | grep pg_data
```

服务器上没有 `python3` 时不用装：`docker compose config` 输出的第一行就是 `name: <项目名>`，而卷名规则固定是 `<项目名>_pg_data`，两者拼起来即可。

若项目名不稳定，在 `.env` 中固定：

```bash
echo 'COMPOSE_PROJECT_NAME=<线上项目名>' >> .env
```

打印出的 volume 必须**逐字等于**线上已有卷名，否则新容器会在空卷上初始化一套空库。

### 2.3 HTTPS 域名必须成对配置

只在**对外使用 HTTPS 域名**时设置，两项必须同时给，否则容器启动即 fatal 退出：

```yaml
      - SESSION_COOKIE_SECURE=true
      - SESSION_COOKIE_TRUSTED_URL=https://你的域名
```

规则（`common/session_cookie.go`，违反即退出）：

- 只给 `TRUSTED_URL` 不给 `SECURE=true` → fatal
- 只给 `SECURE=true` 不给 `TRUSTED_URL` → fatal
- `TRUSTED_URL` 只接受 `https://` + 精确 host，**不支持通配符、路径、域名后缀**
- 端口也算 Origin 的一部分
- 它只约束 refresh / logout 的 Origin 校验，**不是** relay 的 CORS 白名单

本地 HTTP 调试时两项都**不要设**。

### 2.4 获取镜像

#### 方式一：本地构建后传输（推荐，服务器不装构建链）

本地（Windows PowerShell）：

```powershell
cd <仓库目录>
$env:DOCKER_BUILDKIT='0'
docker build -t jingyu-api:test .
```

- 镜像分三阶段：`oven/bun` 构建前端 → `golang` 编译并 `//go:embed` 前端 → `debian:bookworm-slim` 运行
- **宿主机不需要先 `bun run build`**，前端在镜像第一阶段重新构建并嵌入二进制
- 基础镜像按 digest 固定，本地已存在会被复用；报 `failed to authorize ... auth.docker.io` 是到 Docker Hub 超时，确认三个 base 镜像本地在（`docker images | grep -E 'oven/bun|golang|debian'`）后重试
- 境内 goproxy 不通时：`docker build --build-arg GOPROXY=https://proxy.golang.org,direct -t jingyu-api:test .`
- 构建机与服务器架构不一致时必须指定：`docker build --platform linux/amd64 -t jingyu-api:test .`

**构建完先自检，两步都要过**：

```bash
docker run --rm --entrypoint ls jingyu-api:test -la /            # 必须能看到 jingyu-api
docker run --rm --entrypoint ls jingyu-api:test -la /licenses    # LICENSE / NOTICE / THIRD-PARTY-LICENSES.md
```

> ⚠️ **不要用 `docker run jingyu-api:test --version` 做自检**。二进制只识别 `plugin` 子命令，其它参数会被忽略并直接启动服务，随后因缺少 `SESSION_SECRET` 立即 fatal 退出。看起来像「自检失败」，实际是参数不被支持。

**冒烟测试**（用镜像内置的 SQLite 起一个临时容器，不碰任何线上容器和端口）：

```powershell
# 本地 Windows PowerShell
docker run -d --rm --name jingyu-smoke -p 13000:3000 `
  -e SQLITE_PATH=/data/smoke.db `
  -e SESSION_SECRET=smoke-check-0123456789 `
  -e CRYPTO_SECRET=smoke-check-0123456789 `
  jingyu-api:test
Start-Sleep -Seconds 15
(Invoke-WebRequest 'http://localhost:13000/api/status' -UseBasicParsing).Content   # 含 "success":true
(Invoke-WebRequest 'http://localhost:13000/' -UseBasicParsing).StatusCode          # 200
docker rm -f jingyu-smoke
```

```bash
# 服务器 / Linux
docker run -d --rm --name jingyu-smoke -p 13000:3000 \
  -e SQLITE_PATH=/data/smoke.db \
  -e SESSION_SECRET=smoke-check-0123456789 \
  -e CRYPTO_SECRET=smoke-check-0123456789 \
  jingyu-api:test
sleep 15
curl -s http://127.0.0.1:13000/api/status | head -c 200
curl -sI http://127.0.0.1:13000/ | head -1                                        # HTTP/1.1 200 OK
docker rm -f jingyu-smoke
```

`SESSION_SECRET` / `CRYPTO_SECRET` 随便填个非 `random_string` 的值即可——这一步只验证二进制能启动、embedded 前端能吐出来，不连你的数据库。

传输：

```powershell
# 包放在仓库根目录，命名带日期，便于回滚时辨认代次
cd <仓库目录>
docker save -o jingyu-api-20261020.tar jingyu-api:test      # 换成当天日期
scp jingyu-api-20261020.tar root@<服务器IP>:~/
```

**不要 gzip 这个包**。`docker save` 写出的层本来就是压缩存储的，再压一次只省约 1%（74.2 MB → 73.4 MB），反而多一个后缀、多一步解压。

放仓库根目录不会污染 `git status`：`.gitignore` 第 48 行已忽略 `*.tar`（但**不匹配** `*.tar.gz`，这也是别压缩的另一个理由）。

```bash
# 服务器上：先校验完整性，再加载
sha256sum ~/jingyu-api-20261020.tar          # 与本地 Get-FileHash 的结果比对
docker load -i ~/jingyu-api-20261020.tar

# 确认加载进来的确实是新镜像，且架构对
docker image inspect jingyu-api:test --format '{{.Id}} {{.Created}} {{.Os}}/{{.Architecture}}'
```

最后一条必须是 `linux/amd64`。构建机是 Windows / macOS 时默认平台可能不同，架构不符的镜像 `docker load` 能成功，但容器起来就报 `exec format error`。

#### 方式二：服务器直接构建

```bash
cd <部署目录>
docker build -t jingyu-api:test .
```

省掉传输，但吃服务器 CPU / 内存，且需要能拉取基础镜像。

#### 方式三：私有镜像仓库

`docker tag` + `docker push`，服务器 `docker pull`。

### 2.5 首次启动

**拓扑 A（直连）**：使用仓库自带的 `docker-compose.yml`。

```bash
cd <部署目录>
docker compose up -d
docker compose ps
```

**拓扑 B（反代）**：生产编排文件与仓库里那份**结构不同**（多了反代、API 不发布宿主端口），首次部署需按下面的形状准备，或沿用已有的生产编排文件。

```yaml
services:
  jingyu-api:
    image: jingyu-api:test
    container_name: jingyu-api
    restart: always
    command: --log-dir /app/logs
    # 拓扑 B 不写 ports：反代通过 Docker 网络访问容器内 3000
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    environment:
      - "SQL_DSN=postgresql://root:${POSTGRES_PASSWORD}@postgres:5432/jingyu-api"
      - "REDIS_CONN_STRING=redis://:${REDIS_PASSWORD}@redis:6379"
      - TZ=Asia/Shanghai
      - ERROR_LOG_ENABLED=true
      - BATCH_UPDATE_ENABLED=true
      - NODE_NAME=jingyu-api-node-1
      - "SESSION_SECRET=${SESSION_SECRET}"
      - "CRYPTO_SECRET=${CRYPTO_SECRET}"
      - SESSION_COOKIE_SECURE=true
      - SESSION_COOKIE_TRUSTED_URL=https://你的域名
    depends_on:
      - redis
      - postgres
    networks:
      - jingyu-api-network

  jingyu-caddy:
    image: caddy:2-alpine
    container_name: jingyu-caddy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy/data:/data
      - ./caddy/config:/config
    networks:
      - jingyu-api-network

  postgres:
    image: postgres:15
    container_name: jingyu-postgres
    restart: always
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
      POSTGRES_DB: jingyu-api
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - jingyu-api-network

  redis:
    image: redis:latest
    container_name: jingyu-redis
    restart: always
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD:?REDIS_PASSWORD is required}"]
    networks:
      - jingyu-api-network

volumes:
  pg_data:

networks:
  jingyu-api-network:
    driver: bridge
```

`Caddyfile` 关键行：

```
你的域名 {
    reverse_proxy jingyu-api:3000
}
```

> ⚠️ 生产环境**不要**用仓库里的 `docker-compose.yml` 覆盖服务器那份：仓库版给 API 加了 `ports: "3000:3000"`，会平白多出一个宿主端口（可能冲突，也绕过了反代）。**两边 compose 结构不同，更新时只换镜像。**

### 2.6 启动后验证

```bash
docker compose ps                                  # 三个以上容器 Up，API 为 healthy
curl -s http://127.0.0.1:3000/api/status | head -c 400     # 拓扑 A
curl -s https://你的域名/api/status | head -c 400           # 拓扑 B
docker compose logs --tail=200 jingyu-api | grep -iE 'fatal|panic|error'
```

`/api/status` 应包含 `system_name`、非空 `version`、`quota_display_type`。

**首次启动的已知现象**：compose 里 postgres 没有 healthcheck，`depends_on` 用短格式，只保证启动顺序、不等数据库就绪。API 可能先崩一到两轮（`restart: always` 会兜住），表现为日志里两条 `failed to connect to ... database system is starting up`，属正常。

浏览器侧再确认：能登录、刷新不掉登录、`/docs` 可打开、页脚 AGPL 署名仍在。

***

## 三、日常更新（换镜像）

### 3.1 先备份，再打回滚标签

```bash
cd <部署目录>
STAMP=$(date +%F-%H%M)

# 数据库（自定义格式，便于 pg_restore）
# 不要加 docker exec -t：分配 TTY 会改写字节流，把二进制转储弄坏
docker exec jingyu-postgres pg_dump -U root -d jingyu-api -Fc > ~/jingyu-$STAMP.dump
head -c 5 ~/jingyu-$STAMP.dump; echo "   <- 必须是 PGDMP"
# 宿主挂载数据与日志
tar czf ~/jingyu-data-$STAMP.tar.gz data logs

# 编排文件与 env
cp docker-compose.yml ~/docker-compose.yml.$STAMP.bak
cp -a .env ~/dotenv.$STAMP.bak 2>/dev/null

# 回滚标签：给「当前正在用的镜像」打标签
docker tag <当前镜像ID> jingyu-api:rollback-$STAMP
```

> **`-i` 到底谁是参数，这里最容易搞混**：`docker exec -i` 的 `-i` 用于把 stdin 送进容器，只在 `pg_restore ... < 文件`、heredoc、`kubectl apply` 这类需要读标准输入的场合才加；**它属于 `docker exec`，不属于 `psql` / `pg_restore`**。写成 `psql -i` 会得到 `psql: invalid option -- 'i'`。用 `-c "单行 SQL"` 传语句时不需要 `-i`。

> 顺带记一条：服务器上即使装了 psql 客户端也连不进去——Postgres 容器不发布 5432 到宿主机，只能 `docker exec` 进去执行（拓扑 B 尤其如此）。

### 3.2 镜像 tag 被「顶掉」是正常的

导入或拉取同名 tag 的新镜像后，`docker images` 会出现：

| 镜像 ID | 状态 | 标签 | 说明 |
| --- | --- | --- | --- |
| `2fae47182199` | 未使用 | `jingyu-api:test` | 新镜像，尚未被任何容器使用 |
| `27a7ac83c081` | **已使用** | （无标签） | **正在跑的旧镜像**，tag 已被移走 |

原因：tag 只是一个指针，新镜像导入后指针指向新 ID，旧镜像变成无标签，但**运行中的容器仍然按旧 ID 运行**。

⚠️ 因此打回滚标签必须用**旧镜像的 ID**，不能用 tag：

```bash
docker tag 27a7ac83c081 jingyu-api:rollback-20261019     # 对
# docker tag jingyu-api:test jingyu-api:rollback-xxx     # 错：这是新镜像
```

确认容器实际用的镜像：

```bash
docker inspect jingyu-api --format '{{.Image}}'
```

### 3.3 重建容器（唯一能生效的方式）

`docker load` 只把镜像写进本地仓库，**运行中的容器永远不会换镜像**——容器创建时已绑定旧镜像 ID，且进程已加载进内存。

| 命令 | 行为 |
| --- | --- |
| `docker compose up -d` | 按需重建：判断配置哈希与镜像 ID，变了才重建，没变跳过 |
| `docker compose up -d --force-recreate` | 无条件重建：跳过判断，一律重建 |
| 末尾的服务名 | **服务名**（compose 里 `services:` 下的 key），不是容器名也不是镜像名 |
| `--no-deps` | 不处理依赖服务，避免连带重建 Postgres / Redis |

**推荐写法**：

```bash
# 1) 查服务名（不要照抄，以实际输出为准）
docker compose config --services

# 2) 预演：确认只会动 API 一个
docker compose --dry-run up -d --force-recreate --no-deps jingyu-api

# 3) 执行
docker compose up -d --force-recreate --no-deps jingyu-api
```

不带服务名 = 作用于**所有**服务，若 compose 认为 Postgres 或反代需要重建，它们会被一并重启，影响面远超预期。

**中断时间**：等于「停旧容器 + 建新容器 + 应用启动连库」，实测约 **2 秒**（Go 二进制启动快、Postgres/Redis 已就绪）。这段时间内反代会拿到 connection refused 并返回 502；**正在进行中的流式请求会被掐断**，客户端重试无法恢复。需要彻底零中断请走第四节。

### 3.4 验证

```bash
docker inspect jingyu-api --format '{{.Image}}'     # 应为新镜像 ID
docker ps --format 'table {{.Names}}\t{{.Status}}'  # API 刚起；其余容器 uptime 很长 = 未被触碰
docker compose logs --tail=80 jingyu-api | grep -iE 'fatal|panic|error' || echo "日志干净"
curl -s https://你的域名/api/status | head -c 300
```

前端已 `//go:embed` 进二进制，所以**没有独立的静态资源部署步骤**：换了镜像，浏览器刷新即生效。反过来同样成立——**改了 `web/src` 必须重建镜像才会生效**，重启容器或刷新页面都不会。

### 3.5 回滚

```bash
docker tag jingyu-api:rollback-<STAMP> jingyu-api:test
docker compose up -d --force-recreate --no-deps jingyu-api
```

数据库要恢复时（**先确认卷没换过**）：

```bash
docker exec -i jingyu-postgres pg_restore -U root -d jingyu-api --clean --if-exists < ~/jingyu-<STAMP>.dump
```

### 3.6 部署后预置配置项（可选，不需要重建容器）

注册在 `setting/` 下的配置都能在部署完成后直接写进 `options` 表，不必等界面点保存。键名规则是 `模块名.字段名`，值一律按文本存：

```bash
docker exec jingyu-postgres psql -U root -d jingyu-api -c "INSERT INTO options (key, value) VALUES ('perf_metrics_setting.published_tps_factor','1.4') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"
```

生效路径：

- 进程内每 `SYNC_FREQUENCY` 秒（默认 60）把库里的 `模块名.字段名` 回灌到内存配置对象
- 从管理面板保存则立即生效，不用等
- 两者都不需要重建容器 —— **只有二进制或前端代码变更才需要**，纯配置/数据调整不要走第三节

`options` 表以 `key` 为主键，`ON CONFLICT DO UPDATE` 可以反复执行，不会产生重复行。

***

## 四、蓝绿发布（零中断）

### 4.1 原理与前提

蓝绿的切换点必须有一个「能把流量从 A 改到 B」的组件：

- **拓扑 B（有反代）**：反代就是切换点，改 upstream 即可
- **拓扑 A（直连宿主端口）**：**没有切换点**。宿主 3000 只能被一个容器占用，无法做到零中断。要么先接入反代，要么接受第三节的短中断

前提条件，缺一不可：

1. **本次更新不得包含数据库结构变更**。两个版本同时跑时，若新版启动执行 `AutoMigrate` 改了表结构，旧版可能读写异常。判断方法：
   ```bash
   git diff <旧版本commit>..<新版本commit> --stat -- model/
   ```
   只看新增查询文件（如 `*_scope.go`）通常安全；若改动了带 `gorm` tag 的结构体或新增表，请改用维护窗口。
2. green 必须接入**同一个 Docker 网络**（否则反代用容器名解析不到它）。
3. green **不要发布宿主端口**——反代通过 Docker 网络访问即可，避免端口冲突。
4. `SESSION_SECRET` 必须与旧实例一致（共用同一份 `.env` 即可），否则登录态不互通。

### 4.2 确认网络名与反代上游

```bash
# API 所在网络
docker inspect jingyu-api --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}'

# 反代配置从哪来
docker inspect jingyu-caddy --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'

# 反代如何指向 API（找 reverse_proxy 那行）
docker exec jingyu-caddy cat /etc/caddy/Caddyfile
```

要看到类似 `reverse_proxy jingyu-api:3000` 的行——**这就是切换点**。

### 4.3 green 容器编排

最简单的方式：把 green 作为**同项目的一个额外服务**加进现有编排文件（自动共享网络，无需处理 external 网络命名），切换完成后删除该段。

```yaml
  jingyu-api-green:
    image: jingyu-api:test
    container_name: jingyu-api-green
    restart: unless-stopped
    command: --log-dir /app/logs
    # 不写 ports
    volumes:
      - ./data:/data                 # 共享，保证任务产物路径一致
      - ./logs-green:/app/logs       # 独立，避免两实例抢同一份日志文件
    environment:
      - "SQL_DSN=postgresql://root:${POSTGRES_PASSWORD}@postgres:5432/jingyu-api"
      - "REDIS_CONN_STRING=redis://:${REDIS_PASSWORD}@redis:6379"
      - TZ=Asia/Shanghai
      - ERROR_LOG_ENABLED=true
      - BATCH_UPDATE_ENABLED=true
      - NODE_NAME=jingyu-api-node-2  # 与旧实例区分，便于审计日志辨认
      - "SESSION_SECRET=${SESSION_SECRET}"
      - "CRYPTO_SECRET=${CRYPTO_SECRET}"
      - SESSION_COOKIE_SECURE=true
      - SESSION_COOKIE_TRUSTED_URL=https://你的域名
    depends_on:
      - redis
      - postgres
    networks:
      - jingyu-api-network
```

若 green 必须放在独立编排文件里，需显式引用已存在的网络：

```yaml
networks:
  jingyu-api-network:
    external: true
    name: <4.2 查到的实际网络名>
```

### 4.4 切换流程

```bash
cd <部署目录>

# 1) 起 green（旧实例仍在服务）
docker compose up -d --no-deps jingyu-api-green

# 2) 等它真正可用（不必等 docker healthcheck，它 30 秒才查一次）
until docker exec jingyu-api-green wget -qO- http://127.0.0.1:3000/api/status >/dev/null 2>&1; do sleep 1; done
echo "green 就绪"

# 3) 关键预检：从反代容器里能否解析并访问 green
docker exec jingyu-caddy wget -qO- http://jingyu-api-green:3000/api/status | head -c 200

# 4) 改反代上游：jingyu-api:3000 → jingyu-api-green:3000
#    Caddyfile 通常以 :ro 只读方式挂进容器，改宿主机上那份文件（路径见 4.2 的 mounts 输出）
vi <宿主机 Caddyfile 路径>

# 5) 校验并优雅重载（reload 不断开已建立的连接，包括 SSE 流式响应）
docker exec jingyu-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec jingyu-caddy caddy reload --config /etc/caddy/Caddyfile

# 6) 观察确认新实例在接流量
docker logs --tail=50 jingyu-api-green | grep -iE 'fatal|panic|error' || echo "日志干净"
docker exec jingyu-caddy wget -qO- http://jingyu-api-green:3000/api/status | head -c 200

# 7) 停掉旧容器（只删容器，数据卷不动）
docker rm -f jingyu-api
```

> 若反代不是 Caddy 而是 Nginx/OpenResty：改 upstream 后 `nginx -t && nginx -s reload`（OpenResty 用 `openresty -t && openresty -s reload`），同样是优雅重载。若反代由面板（如 1Panel「网站 → 反向代理」）管理，直接在面板改目标端口并保存，面板会自动重载。

### 4.5 收尾：双槽位乒乓

**不要改名**——改名等于新建容器，又会造成一次中断。把两份服务定义都长期保留，形成两个固定槽位：

| 槽位 | 服务名 | 日志目录 | 当前状态 |
| --- | --- | --- | --- |
| A | `jingyu-api` | `./logs` | 刚被停掉 |
| B | `jingyu-api-green` | `./logs-green` | 正在服务 |

下次更新时反向操作即可，**服务名永远不变**：

```bash
# 1) 更新 A 槽（用新镜像重建；此时 B 仍在服务，无中断）
docker compose up -d --force-recreate --no-deps jingyu-api
until docker exec jingyu-api wget -qO- http://127.0.0.1:3000/api/status >/dev/null 2>&1; do sleep 1; done

# 2) 反代上游改回 jingyu-api:3000，校验并重载
docker exec jingyu-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec jingyu-caddy caddy reload   --config /etc/caddy/Caddyfile

# 3) 停掉 B 槽
docker rm -f jingyu-api-green
```

两个槽位的 `image` 都写 `jingyu-api:test`，重建时自然取到当前 tag 指向的新镜像。此后每次更新都在这两个槽位之间交替，切换永远只是一次 `reload`。

### 4.6 蓝绿的回滚

```bash
# 反代上游改回 jingyu-api:3000，reload
docker exec jingyu-caddy caddy reload --config /etc/caddy/Caddyfile

# 旧容器若已删除，用回滚标签重新拉起
docker tag jingyu-api:rollback-<STAMP> jingyu-api:test
docker compose up -d --force-recreate --no-deps jingyu-api

# 停掉 green
docker rm -f jingyu-api-green
```

***

## 五、常见问题

### Q1：更新后有请求返回 502

反代找不到上游。依次检查：

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'          # API 是否 Up
docker exec jingyu-api wget -qO- http://127.0.0.1:3000/api/status | head -c 200
docker exec jingyu-caddy wget -qO- http://jingyu-api:3000/api/status | head -c 200
docker exec jingyu-caddy cat /etc/caddy/Caddyfile           # 上游名字/端口是否写错
```

### Q2：站点能打开，但数据「全没了」

卷名不匹配——新容器在空卷上初始化了空库。

```bash
docker volume ls | grep pg_data
docker inspect jingyu-postgres --format '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{"\n"}}{{end}}'
docker compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["volumes"]["pg_data"]["name"])'
```

两处的卷名必须逐字一致。修复：在 `.env` 里固定 `COMPOSE_PROJECT_NAME` 为旧卷名对应的项目名，再 `docker compose up -d`。

### Q3：容器启动即退出，日志里有 fatal

三种典型原因：

| 日志 | 原因 |
| --- | --- |
| `SESSION_COOKIE_TRUSTED_URL requires SESSION_COOKIE_SECURE=true` | 两项没有成对配置 |
| `SESSION_COOKIE_SECURE=true requires SESSION_COOKIE_TRUSTED_URL` | 同上，反向缺失 |
| `Please set SESSION_SECRET to a random string.` | `SESSION_SECRET` 写成了字面量 `random_string` |

### Q4：容器起不来，报 `no such service`

末尾填的是**服务名**，不是容器名：

```bash
docker compose config --services
```

### Q5：healthcheck 长时间是 `starting`

compose 的 healthcheck 每 30 秒一次、失败 3 次才判 unhealthy，首查最长要等 30 秒。直接用 curl / wget 打 `/api/status` 判断更快。若确实不 healthy：

```bash
docker compose logs --tail=50 postgres
docker compose logs --tail=50 jingyu-api | head -40
```

### Q6：`docker rm -f` 和 `--force-recreate` 有区别吗

对单个服务而言效果等价（都是「用当前镜像建一个新容器」）。区别是 `--force-recreate` 通过 compose 走，会重新套用编排里的网络、卷、环境变量；`docker rm -f` + `docker compose up -d` 是两步手工操作。**优先用 compose 那条**，配置一致性更有保障。

### Q7：能不能不重建容器，只替换二进制

不能。容器创建时绑定镜像 ID，进程已加载进内存；替换文件对运行中的进程无效。要么重建容器，要么用蓝绿切换。

### Q8：`psql: invalid option -- 'i'`

`-i` 属于 `docker exec`，不属于 `psql`。这个报错说明命令被主机上的 psql 接走了（`docker exec` 那段没生效）。正确写法：

```bash
docker exec jingyu-postgres psql -U root -d jingyu-api -c "SELECT 1;"        # 不需要 -i
docker exec -i jingyu-postgres psql -U root -d jingyu-api < 备份.sql         # 需要 stdin 时才加 -i
```

另外主机上的 psql 即使装了也连不进去：Postgres 容器不发布 5432 到宿主机。

### Q9：多行 SQL 报 `syntax error at or near "SQLdocker"`

heredoc 的收尾标记 `SQL` 和下一行命令粘成了一句，通常是粘贴时丢了换行。多行 SQL 一律改成 `-c "……"` 单行传，或在服务器上先落成 `.sql` 文件再 `<` 重定向。

### Q10：`docker image prune` 会把回滚镜像一起删掉

无标签的旧镜像（tag 被新镜像顶掉之后就是这个状态）在 `prune` 眼里和废物一样。**想留哪个，先 `docker save` 成 tar**，再清理。

一次三阶段构建大约产生 15–20 GB 中间层，磁盘紧张时值得清，但顺序不能颠倒：

```bash
docker save -o ~/jingyu-api-$(date +%Y%m%d).tar <要保留的镜像ID>   # 先留后清
docker image prune -f
```

***

## 六、命令速查

```bash
# 现状
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker compose config --services
docker inspect jingyu-api --format '{{.Image}}'
docker compose config --format json | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["name"], d["volumes"]["pg_data"]["name"])'

# 打包 → 传输 → 加载（包放仓库根目录，不带 .gz）
docker save -o jingyu-api-$(date +%Y%m%d).tar jingyu-api:test
sha256sum jingyu-api-$(date +%Y%m%d).tar                 # 本地与服务器各算一次比对
docker load -i jingyu-api-$(date +%Y%m%d).tar
docker image inspect jingyu-api:test --format '{{.Id}} {{.Os}}/{{.Architecture}}'   # 必须是 linux/amd64

# 冒烟（不碰线上容器）
docker run -d --rm --name jingyu-smoke -p 13000:3000 \
  -e SQLITE_PATH=/data/smoke.db -e SESSION_SECRET=smoke-check-0123456789 \
  -e CRYPTO_SECRET=smoke-check-0123456789 jingyu-api:test
sleep 15 && curl -s http://127.0.0.1:13000/api/status | head -c 200
docker rm -f jingyu-smoke

# 备份
docker exec jingyu-postgres pg_dump -U root -d jingyu-api -Fc > ~/jingyu-$(date +%F-%H%M).dump

# 回滚标签
docker tag <旧镜像ID> jingyu-api:rollback-$(date +%F)

# 更新（预演 → 执行）
docker compose --dry-run up -d --force-recreate --no-deps jingyu-api
docker compose up -d --force-recreate --no-deps jingyu-api

# 验证
docker inspect jingyu-api --format '{{.Image}}'
curl -s https://你的域名/api/status | head -c 300

# 改配置（不重建容器）
docker exec jingyu-postgres psql -U root -d jingyu-api -c "INSERT INTO options (key, value) VALUES ('模块名.字段名','值') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"

# 蓝绿切换
docker exec jingyu-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec jingyu-caddy caddy reload --config /etc/caddy/Caddyfile
```

***

## 相关文档

- [宝塔面板部署](BT.md)
- [模型广场对外指标口径](../model-square-published-metrics.md)
- [环境变量说明](../../.env.example)
- 上游项目文档：<https://docs.newapi.pro>
