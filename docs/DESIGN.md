# LunaTV · Nocturne 设计系统

> 一次全站视觉重构。概念：**月光下的放映厅（Midnight Cinema）**。
> 界面是一间被月光照亮的夜间影院——墨夜靛蓝的空间、香槟金的月光、
> 银灰的文字、细线描边的器物、等宽字体的场记板式元数据。

## 为什么长这样

流媒体大厂的配色已被瓜分：Netflix 红、HBO 紫黑、Hulu 绿、Disney 蓝。
**没有人拥有金色。** LunaTV 的名字里就有月亮——于是品牌色是
"Moonglow" 香槟金，中性色是带靛蓝底的"Ink"夜空灰，点缀色全部
去饱和调入夜色。金色在黑夜里是光源，在白昼里是黄铜——两种主题
都由同一个隐喻推导，不是简单的明暗反转。

## 架构：一层 Token 承载全站

本项目 UI 约 6.8 万行，全部使用 Tailwind 语义（`gray-*`、`green-*`……）。
重构的核心手法是在 `src/app/globals.css` 的 `@theme` 里**重定义调色板
本身**，让所有页面（包括 8.7k 行的 admin）一次性继承新视觉；再对高频
界面（导航、卡片、首页、登录、选择器）做手工重设计。

### 调色板映射（@theme）

| Tailwind 键 | 新角色 | 说明 |
| --- | --- | --- |
| `gray-*` / `slate` / `zinc` / `neutral` / `stone` | **Ink** 夜空中性色 | 50 纸白 → 950 墨夜，全程带靛蓝底色 |
| `green-*`（+`emerald`、`primary`） | **Moonglow** 香槟金 | 品牌色。400 是暗色主题的金，600 是亮色主题的铜金（白底 AA ≥4.8:1） |
| `blue-*` / `sky` / `indigo` | Steel 月光钢蓝 | 信息、链接，去饱和 |
| `red-*` / `rose` | Copper 铜焰红 | 错误、危险、直播，微暖以配金 |
| `purple-*` / `violet` / `fuchsia` | Wisteria 紫藤 | AI、短剧等特色功能 |
| `yellow` / `amber` / `orange` | 金橙族 | 与品牌金同族、梯度可辨 |
| `teal` / `cyan` | Selene 月海青 | 直播频道等 |
| `white` / `black` | `#fdfcf9` / `#05070d` | 暖纸白与靛墨黑，统一全站色温 |

新代码可用语义别名：`gold-*`（=green-*）、`ink-*`（=gray-*）。

### 组件类（globals.css @layer components）

- `.eyebrow` — 等宽全大写金色眉题（编辑式双语标题的上行）
- `.glass-panel` — 夜幕毛玻璃面板：细线描边 + 顶部内光 + 深投影
- `.hairline-card` — 细线卡面，hover 点亮金边
- `.btn-gold` / `.btn-ghost` — 满月金主按钮 / 细线幽灵按钮
- `.meta-badge`（+`-gold`） — 等宽元数据徽章（集数 / 年份 / 评分）
- `.moon-loader` — 月牙加载环
- `.progress-gold` — 金色进度条（带光尖）

### 氛围层

- 页面背景：CSS 径向渐变绘制的**月晕**（暗色）与**晨晖**（亮色），
  `background-attachment: fixed`，零请求
- 胶片颗粒：`body::before` 内联 SVG 噪点，2.8%/5% 不透明度，静态零开销
- 文字选区金色、`:focus-visible` 统一金环、`prefers-reduced-motion` 全局降级

## 手工重设计的界面

| 界面 | 变化 |
| --- | --- |
| `ModernNav` | 桌面：文字导航 + 当前项金色月点；移动：**浮岛 Dock** + 玻璃抽屉 |
| `BrandMark`（新） | 金色月牙 + 站名，登录页 / 导航 / 移动头共用（渐变 id 用 `useId` 防隐藏 defs 引用变黑） |
| `VideoCard` | 细线描边海报、hover 金环辉光 + 满月播放盘、等宽徽章、金色进度条 |
| `SectionTitle` | 中英双语编辑式标题（`TRENDING FILMS` / 热门电影） |
| `CapsuleSwitch` / `DoubanSelector` | 滑动金块指示器（测量式，无依赖） |
| `HeroBanner` | 满月金播放键、金签评分、金色页标 |
| 登录 / 注册 | 月夜场景：大月晕 + 呼吸星点 + 玻璃卡片 |
| `EpisodeSelector` / 播放器 | ArtPlayer 主题色 `#e6b94a`，选集金块 |
| 骨架屏 | 夜色底 + 金光扫过 |

## 性能守则（本次遵守）

- **零新增运行时依赖**、零新增字体文件、零外链资源
- 所有氛围效果是纯 CSS（渐变 / 内联 SVG data URI）
- 交互动画只用 transform/opacity；`prefers-reduced-motion` 全局尊重
- 未触碰数据流、路由、代码分割结构；`pnpm-lock.yaml` 无变化

## 对比度基线

- 亮色：`green-600` #96690a 于白底 ≈ 4.8:1（AA）；正文 `gray-600+` ≥ 7:1
- 暗色：`green-300/400` 于 `gray-900` ≥ 9:1；正文 `gray-200/300` ≥ 10:1
