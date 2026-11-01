# 蓝星旅记 · BlueStarTravelogue PWA

以个人行动轨迹、地点停留和带定位照片回顾为核心的旅行记录 PWA。

这是原 SwiftUI iOS 应用的网页迁移版：不需要 App Store、不需要开发者账号，**浏览器打开即用，可「添加到主屏幕」当作 App 使用**。

> 原 iOS 版受限于「非注册开发者只有 7 天有效期」，因此迁移为 PWA。网页版保留了「今天 / 轨迹 / 回顾 / 我的」四大主入口与全部详情页，以及照片导入、GPS 自动归属、手动补录、JSON 备份。

## 功能

- 🗺️ **轨迹地图**：用 MapLibre + 免费瓦片展示地点与照片分布
- 📍 **停留与时间线**：按天聚合停留，形成从早到晚的时间线
- 📷 **照片导入与自动归属**：读取照片 EXIF 的 GPS 与拍摄时间，自动匹配日期、最近地点（400m）和停留（±15 分钟）
- ✍️ **手动补录**：补地点、补停留，支持地图选点与浏览器定位
- 🗓️ **回顾**：按日 / 周 / 月查看记录热力、常去地点与照片回忆
- 🔧 **地点管理**：合并重复地点、删除地点
- 💾 **本地优先 + 备份**：数据存 IndexedDB，可导出 / 导入 JSON
- 📲 **可安装 PWA**：manifest + Service Worker，离线可打开

## 技术栈

| 部分 | 选型 |
| --- | --- |
| 框架 | Vue 3 + TypeScript |
| 构建 | Vite |
| 路由 | Vue Router |
| 地图 | MapLibre GL JS + Carto / OSM 免费瓦片 |
| 本地存储 | Dexie（IndexedDB） |
| EXIF | exifr |
| PWA | vite-plugin-pwa（Workbox） |

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发（默认 http://localhost:5173）
pnpm dev

# 类型检查 + 生产构建
pnpm build

# 预览构建产物
pnpm preview
```

> 定位 API 需要安全上下文（`localhost` 或 HTTPS）。

### 没有安装 Node.js 时

如果本地目录里已经有构建好的 `dist/`（交付时已附带），可以直接用系统自带的 `python3` 预览：

```bash
./serve.sh          # 默认 http://localhost:8000
./serve.sh 8080     # 指定端口
```

因为路由使用 hash 模式（`/#/today`），静态服务器无需任何 SPA 回退配置。

需要修改代码或重新构建时，再安装 Node.js 18+（推荐 20+）与 pnpm：

```bash
# macOS（Homebrew）
brew install node pnpm

pnpm install
pnpm dev
```


## 数据与隐私

- 所有数据（日期、地点、停留、照片）仅保存在**当前浏览器的 IndexedDB**，不上传任何服务器
- 照片只在用户通过文件选择器主动选择时读取
- 清除浏览器数据或更换设备会丢失本地数据，请定期在「我的 → 导出数据」备份
- 坐标统一使用 **WGS-84**（与照片 EXIF、浏览器 Geolocation 一致）

## 与 iOS 版的关键差异

| 能力 | iOS 版 | PWA 版 |
| --- | --- | --- |
| 后台持续记录轨迹 | 支持（CoreLocation） | ❌ 浏览器不允许长期后台定位 |
| 相册读取 | 系统照片库扫描 | 需用户手动选择文件 |
| 地图坐标 | Apple 地图（GCJ-02，需纠偏） | Carto / OSM（WGS-84，无需纠偏） |
| 存储 | SwiftData | IndexedDB |
| 安装 | App Store / 7 天签名 | 浏览器「添加到主屏幕」 |

因此网页版的「轨迹」主要来自：**导入照片的 EXIF GPS** + **手动补录的带坐标停留** + **前台定位**。

## 目录结构

```text
src/
  main.ts                # 入口
  App.vue                # 壳层 + Tab 栏 + Toast
  router/                # 路由
  models/types.ts        # 领域模型与常量
  db/                    # Dexie 数据库 + liveQuery 封装
  services/
    geo.ts               # 距离 / 坐标（含 GCJ-02 备用工具）
    photoService.ts      # 照片导入、EXIF、自动归属、计数重算、地点合并
    photoScope.ts        # 照片范围过滤
    timeline.ts          # 时间线 / 摘要组装
    geolocation.ts       # 浏览器定位
    backup.ts            # JSON 导出 / 导入
    seed.ts              # 示例数据
    format.ts            # 展示格式化
  composables/           # 复用逻辑（照片导入）
  stores/                # Pinia 全局状态
  components/
    ui/                  # 卡片、Chip、Hero、空态等通用组件
    map/MapView.vue      # MapLibre 封装
  views/                 # 四大 Tab + 全部详情页
  styles/                # 主题变量与全局样式
scripts/generate-icons.py # 生成 PWA 图标
```

## 数据模型

```text
Day 1 ── n Visit
Day 1 ── n Photo
Location 1 ── n Visit
Location 1 ── n Photo
Visit 1 ── n Photo
```

派生字段（`photoCount` / `visitCount` / `totalStayDuration`）由明细数据重算，避免多处维护不一致。

## 路线图

- [x] 项目骨架与四大 Tab
- [x] IndexedDB 数据层与示例数据
- [x] 照片导入、EXIF 解析、自动归属
- [x] 地图、时间线、回顾、地点管理
- [x] 手动补录与地图选点
- [x] JSON 导出 / 导入
- [x] PWA manifest / Service Worker / 图标
- [ ] 标签体系
- [ ] 轨迹段（TrackSegment）与路线绘制
- [ ] iCloud / 云同步（可选）

## 许可

当前为私有项目，未附加开源许可。
