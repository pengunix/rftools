# AGENTS.md — 妙妙小工具

本仓库是「妙妙小工具」在线工具集。根目录是工具集总入口，`tools/` 下每个子文件夹是一个独立工具，
纯静态托管，可直接部署到 GitHub Pages。

当前包含工具：
- **史密斯圆图**（`tools/smith-chart/`）—— 高保真复刻，含源码与定制功能。
- **Bode-Fano 计算器**（`tools/bode-fano/`）—— 纯手写静态工具（原生物理公式实现）。
- **在线电路模拟器**（`tools/circuit/`）—— 复刻 CircuitJS1 web 版（GWT 产物，抓自 cc.xiaogd.net）。

> 与最初「直接使用源站产物」不同，现在史密斯圆图有一套**可修改的源码**（在 `source/smith-chart/`），
> 基于上游开源项目 `github.com/28raining/smith-chart`，并做了本项目定制（见第 4 节）。
> 修改功能时改源码 → 构建 → 把 `dist/` 复制到 `tools/smith-chart/`。
> Bode-Fano 是手写零依赖静态页，直接改 `tools/bode-fano/` 即可，无需构建。


---

## 1. 目录结构

```
妙妙小工具/                       # 仓库根（GitHub Pages 站点根）
├── index.html                    # 工具集总入口（工具列表卡片）
├── favicon.svg                   # 站点图标
├── css/hub.css                   # 总入口样式
├── AGENTS.md                     # 本文件
├── .nojekyll                     # GitHub Pages 原样发布（不经 Jekyll）
├── .gitignore                    # 排除 _ref/、node_modules、dist 等
│
├── source/                       # 各工具的【源码】（不直接发布）
│   └── smith-chart/              # 史密斯圆图源码（React + Vite，上游 fork + 本项目改动）
│       ├── src/                  # 组件、逻辑、i18n  locales/*.json
│       ├── public/               # 静态资源
│       ├── index.html            # Vite 入口
│       ├── package.json / vite.config.js
│       └── ...                   # tests/ scripts/ tutorials/ 等上游文件
│
└── tools/                        # 各工具的【构建产物 / 静态页】（发布这里）
    ├── smith-chart/              # = source/smith-chart 的 dist 输出
    │   ├── index.html
    │   ├── favicon.svg
    │   └── assets/               # 哈希文件名的 JS/CSS/语言包
    └── bode-fano/                # Bode-Fano 计算器（手写零依赖静态页）
        ├── index.html
        ├── css/style.css
        ├── assets/logo.svg
        └── js/app.js             # i18n + Bode-Fano 公式 + SVG 曲线
    └── circuit/                  # 在线电路模拟器（CircuitJS1 GWT 产物，抓自 cc.xiaogd.net）
        ├── index.html            # GWT 入口
        ├── lz-string.min.js
        ├── font/                 # fontello 图标字体
        └── circuitjs1/           # GWT 编译产物：nocache.js、*.cache.js、locale_zh.txt、
                                  #   setuplist.txt、style.css、circuits/ 等
```

设计原则：

- **源码与产物分离**：`source/` 放可读源码（不含 node_modules、dist）；`tools/` 放构建产物供部署。
- **每工具独立**：一个工具一套 `source/<name>/` + `tools/<name>/`。
- **相对路径**：`vite.config.js` 已设 `base: './'`，产物用相对路径，兼容
  `https://<user>.github.io/<repo>/` 子路径部署。

---

## 2. 本地预览（不用构建，直接跑产物）

用 **Git Bash / MSYS2** 在仓库根启动静态服务器：

```bash
cd "/c/Users/<你>/Documents/妙妙小工具"
python -m http.server 8788 --bind 127.0.0.1
# 首页       http://127.0.0.1:8788/
# 史密斯圆图 http://127.0.0.1:8788/tools/smith-chart/
```

> 必须用 HTTP 服务器；不能 `file://` 直接打开（ES Modules 受限）。

---

## 3. 修改功能 → 重新构建 → 部署

前提：Node.js（含 npm）。首次需要装依赖。

```bash
cd source/smith-chart
npm install            # 首次
# ... 修改 src/ 下的代码 ...
npm run build          # 输出到 source/smith-chart/dist/
# 把产物同步到发布目录：
rm -rf ../../tools/smith-chart/assets
cp -r dist/* ../../tools/smith-chart/
```

刷新浏览器即可看到效果。`npm run dev` 可跑热更新开发服务器（可选）。

---

## 4. 本项目对上游源码的定制（相对 github.com/28raining/smith-chart）

- **移除评论区标签页**：`src/App.jsx` 删除了页面底部的「评论区」整块（含 hyvor 评论组件），
  以及 `@hyvor/hyvor-talk-react` 的 import。
- **移除统计 / 绝对域名**：`index.html` 去掉了 Google Analytics(gtag) 与 canonical/绝对 URL，
  换成了空 `gtag` 存根（避免离线报错、不发送数据）。
- **新增：点圆图自动反算元件参数**（见第 5 节）。

---

## 5. 「点圆图反算元件参数」功能说明

### 用法
1. 点击上方某个**元件**（串联/并联的 电容、电感、电阻；传输线/短截线）→ 页面出现蓝色提示条。
2. 在右侧史密斯圆图上**点击目标阻抗点** → 自动反算出该元件应有的值并填入；底部弹出绿色提示。
3. 若该点在物理上无法用该元件到达（例如用串联电感无法只改实部），底部弹出红色提示，元件保持原值。
4. 每个可反算元件的数值旁有一个**蓝色定位按钮（重选终点）**：点它可再次进入取点模式；
   在该模式下**按住鼠标在圆图上拖动**，可实时连续调整元件值（沿轨迹拖动）。

### 实现要点
- **反算引擎**：`source/smith-chart/src/pickSolve.js`
  - 串联：`Zc = Zt - Zp` → 电感 `L=Im(Zc)/ω`、电容 `C=-1/(ω·Im(Zc))`、电阻 `R=Re(Zc)`。
  - 并联：`Yc = Yt - Yp` → 电感 `L=-1/(ω·Im(Yc))`、电容 `C=Im(Yc)/ω`、电阻 `R=1/Re(Yc)`。
  - 传输线/短截线：扫描电长度 0~0.5λ 取最接近解，返回以 λ 为单位的值。
  - `Zp` = 该元件**之前**所有元件 + 负载的输入阻抗（用 `calculateImpedance` 截断子电路求得）。
- **交互接线**：
  - `src/App.jsx`：`pickMode` 状态、`handlePickPoint`（单击定值）、`handleDragPick`（拖动连续定值）、
    `pickFeedback`（成功/失败 Snackbar）。
  - `src/Graph.jsx`：`click.pick` 与 `mousedown/mousemove.pickdrag` 事件，用
    `getScreenCTM().inverse()` 把屏幕坐标精确映射到圆图用户坐标，再 `smithCoordinatesToImpedance` 求阻抗。
  - `src/Circuit.jsx`：点击元件按钮时对可反算元件自动进入 `pickMode`；在 `ImpedanceComponent` /
    `WireComponent` 里渲染「重选终点」按钮。
- **i18n**：新增 `circuit.pickHint / pickSolved / pickApprox / pickUnsolvable` 与
  `circuit.impedance.repickTooltip`，已补齐 en/zh/es/fr/tr/hi/ja 七个语言包（`src/locales/*.json`）。

---

## 5b. Bode-Fano 计算器（tools/bode-fano）

零依赖手写静态页（`index.html` + `css/style.css` + `js/app.js`），无需构建，直接改即可。

### 功能
- 负载类型：并联 RC / 串联 RC / 并联 RL / 串联 RL（4 种标准集总负载）
- 双向计算：
  - **给定带宽 Δf → 最小反射系数 Γ_min**
  - **给定 Γ → 最大可达带宽 Δf_max**
- 输出：Γ_min、回波损耗(dB)、对应 VSWR、Δf_max、负载时间常数、以及 Γ_min–带宽 曲线（红线标当前值）
- 中英文切换

### 公式（等纹波理想匹配，带宽以 Hz 表示；串联/并联拓扑常数相同，取决于负载时间常数）
- **RC**：`∫ln(1/|Γ|)dω ≤ π/(RC)`
  - `Γ_min = exp(−1/(2·R·C·Δf))`
  - `Δf_max = 1/(2·R·C·ln(1/Γ))`
- **RL**：`∫ln(1/|Γ|)dω ≤ πR/L`
  - `Γ_min = exp(−R/(2·L·Δf))`
  - `Δf_max = R/(2·L·ln(1/Γ))`

实现见 `tools/bode-fano/js/app.js`（`bodeFanoK / gammaMinForBandwidth / bandwidthForGamma`）。

---

## 5c. 在线电路模拟器（tools/circuit）

复刻 https://cc.xiaogd.net（CircuitJS1 web 版，开源项目 github.com/sharpie7/circuitjs1）。
内容是 CircuitJS1 的 **GWT 编译产物**，抓自源站，只做了本地化清理：

- 移除 `index.html` 里的 Google Analytics(gtag) 与百度统计脚本。
- `locale_zh.txt` 等文本资源需以 **UTF-8 原始字节**保存（抓取时勿用 latin1 解码，否则中文乱码）。
- 保持站点相对路径；`circuitjs1/setuplist.txt?v=...` 的查询串由静态服务器忽略即可正常返回。

功能：浏览器内实时电路仿真——绘制电路（电阻/电容/电感/电源/开关/二极管/晶体管等）、
运行/暂停、示波器波形、参数滑块、示例电路等。

> 该工具需通过 HTTP 服务器访问（GWT 依赖 XHR 加载 locale/setuplist），
> 不能 `file://` 直接打开。修改 UI/元件需重新构建上游 GWT 工程，本仓库只托管其产物。

---

## 6. 部署到 GitHub Pages

1. 推送到 GitHub。
2. **Settings → Pages**：Source 选 `Deploy from a branch`，分支 `main`，目录 `/ (root)`。
3. 访问 `https://<user>.github.io/<repo>/`（根目录 `.nojekyll` 已就位）。
4. 自定义域名：根目录加 `CNAME` 文件。

---

## 7. 新增一个工具

1. 新建 `source/<name>/`（源码）与 `tools/<name>/`（产物）。
2. 在根 `index.html` 的 `.hub-main` 复制一张 `.tool-card`，`href` 指向 `./tools/<name>/`。
3. 相对路径互链（返回首页用 `../../index.html`）；构建配置里设 `base: './'`。

---

## 8. 已知说明 / 限制

- `_ref/` 为最初抓取源站的参考资料，已被 `.gitignore` 排除。
- `source/smith-chart/node_modules`、`dist` 不入库（`.gitignore` 已排除）。
- 点图反算的「并联电阻/电感」等在匹配点附近可能无解（物理限制），此时会提示「无法到达」。
- 原站的「重置」按钮行为是跳回站点根（`window.location.origin`）；在子路径部署时会跳到域名根，
  这是上游行为，如需可再调整。
