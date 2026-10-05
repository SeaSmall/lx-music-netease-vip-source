# LX Music 网易云 VIP 音源（lx-wyy）

基于 [NeteaseCloudMusicApi](https://github.com/hudawei996/NeteaseCloudMusicApi) 搭建的**纯本地**网易云音乐 API 服务，为 [LX Music](https://github.com/lyswhut/lx-music-desktop) 提供**网易云音乐音源**与**下载**能力，支持 `128k / 320k / 无损 / 母带(Hi-Res)`。

> 所有请求都在你自己的电脑上完成，账号 Cookie 只保存在本地 `data/` 目录，不会上传到任何服务器。

---

## ✨ 功能特性

- **扫码 / 手机号登录**：一键获取并本地保存网易云账号 Cookie（VIP 权限生效）
- **自动注入 Cookie**：本地服务在服务端自动带上已登录账号 Cookie，音源脚本无需暴露凭证
- **LX 自定义音源（wy）**：支持 `128k`、`320k`、`无损(flac)`、`母带/Hi-Res(flac24bit)`，并带**音质自动降级**
- **命令行下载器**：支持按歌曲 ID 或关键词搜索下载，自动写入歌词（`.lrc`）
- **一键安装音源**：自动把音源写入 LX Music 配置（自动备份原文件）
- **纯本地运行**：服务默认仅监听 `127.0.0.1`

---

## 🙏 致谢

本项目的实现离不开以下优秀开源项目，特此感谢：

- **[NeteaseCloudMusicApi](https://github.com/hudawei996/NeteaseCloudMusicApi)** —— 提供了完整、稳定的网易云音乐 API 实现，是本项目能够获取歌曲链接、歌词等数据的核心基础。感谢原作者 **Binaryify** 及所有贡献者。
- **[LX Music（lx-music-desktop）](https://github.com/lyswhut/lx-music-desktop)** —— 优秀的开源音乐播放器及自定义音源接口，感谢作者 **lyswhut**。
- 感谢所有在开源社区中无私分享的开发者。

如果这些项目对你有帮助，请去给它们点一个 ⭐。

---

## ⚠️ 须知

1. **运行环境**：需要本机安装 [Node.js](https://nodejs.org/)（建议 18 / 20 / 22 / 24）。若使用 Release 中的「免安装包」，则无需再执行 `npm install`。
2. **账号要求**：需要一个网易云音乐账号；**下载无损 / 母带必须开通 VIP**，普通账号只能获取到较低音质。
3. **音源是网易云专用的**：LX 的「音源」是**全局**的，切换到本音源后，酷我 / QQ / 酷狗 / 咪咕等其他平台将无法取到播放链接；需要时请在 LX 设置里切回你原来的音源。
4. **关于「母带」下载**：LX 2.12.2 的**单曲下载弹窗最高只显示到「无损」**（因为它只识别网易云的 `hires` 等级，而网易云把母带标记为 `jymaster`）。要下载母带，请：
   - 在列表里**勾选歌曲 → 右键 → 下载**（会打开「批量下载」窗口，里面有固定的 **无损 - FLAC Hires** 按钮），或
   - 使用本项目的 `node download.js <歌曲> --quality flac24bit`
5. **端口**：本地服务默认 `127.0.0.1:3000`，可通过环境变量 `PORT` / `HOST` 修改（修改端口后需同步修改 `lx-source-wyy.js` 里的 `API_BASE`）。

---

## 📜 免责声明

- 本项目**仅供个人学习、技术研究与交流使用**，**严禁用于任何商业用途或非法用途**。
- 本项目**不提供、不存储、不传播**任何音乐内容；所有音乐数据均来自网易云音乐官方接口，**版权归原作者及版权方所有**。
- 使用本项目所产生的任何后果（包括但不限于账号风险、版权纠纷等）**由使用者自行承担**，作者不承担任何责任。
- 请**支持正版音乐**，通过官方渠道购买会员与数字专辑。请在体验后 **24 小时内删除**相关下载内容。
- 若本项目无意中侵犯了您的合法权益，请提交 Issue，我们会第一时间处理。

---

## 📁 目录结构

```
lx-wyy/
├─ login.js              # 登录脚本（扫码 / 手机号），保存 VIP Cookie
├─ server.js             # 本地网易云 API 服务（自动注入 Cookie）
├─ lx-source-wyy.js      # LX Music 自定义音源脚本
├─ download.js           # 命令行下载器
├─ install-source.js     # 一键把音源安装到 LX Music
├─ start-server.cmd      # 一键启动服务（Windows）
├─ package.json
└─ data/                 # 运行时生成：cookie.json / cookie.txt / qrcode.png（已被 .gitignore 忽略）
```

---

## 🚀 使用教程

### 方式一：下载 Release 免安装包（推荐新手）

1. 到本仓库的 **Releases** 页面下载 `lx-wyy-vX.X.X.zip` 并解压到任意目录。
2. 解压后**直接跳到下面第 2 步「登录」**（包内已含 `node_modules`，无需 `npm install`）。

### 方式二：克隆源码运行

```bash
git clone https://github.com/SeaSmall/lx-music-netease-vip-source.git
cd lx-music-netease-vip-source
npm install
```

### 第 1 步：安装依赖

```bash
npm install
```

### 第 2 步：登录网易云账号

```bash
node login.js
```

- 会自动在屏幕弹出**登录二维码**，用手机「网易云音乐 App → 扫一扫」扫描并确认即可。
- Cookie 会保存到 `data/cookie.json`。

其他登录方式：

```bash
node login.js --phone 你的手机号 --password 你的密码     # 密码登录
node login.js --phone 你的手机号 --send                  # 发送短信验证码
node login.js --phone 你的手机号 --captcha 收到的验证码   # 验证码登录
node login.js --status                                   # 查看当前登录状态
node login.js --logout                                   # 清除本地 Cookie
```

### 第 3 步：启动本地服务

```bash
node server.js
```

Windows 用户可直接双击 `start-server.cmd`。看到 `登录状态: 已登录` 即为正常，**请保持该窗口开启**。

### 第 4 步：把音源安装到 LX Music

> ⚠️ 安装前请**完全退出 LX Music**（否则 LX 退出时会覆盖写入的内容）

```bash
node install-source.js
```

然后打开 **LX Music → 设置 → 音源（自定义源）**，选择 **「网易云VIP音源」**。

> 也可以在 LX 里手动导入：设置 → 音源 → 导入 → 选择 `lx-source-wyy.js`。

### 第 5 步：在 LX Music 中播放 / 下载

1. 搜索时把音乐来源切到 **「网易音乐」**；
2. 点击歌曲即可播放；
3. 下载：
   - 普通音质 / 无损：点歌曲的下载按钮，或右键 → 下载；
   - **母带 / Hi-Res**：**勾选歌曲 → 右键 → 下载 → 「无损 - FLAC Hires」**。

### 第 6 步（可选）：命令行下载

```bash
node download.js "周杰伦 稻香"                 # 搜索并下载第一个结果
node download.js 33894312                      # 按歌曲 ID 下载
node download.js 33894312 1234567              # 批量下载多个 ID
node download.js "稻香" --quality flac24bit    # 指定音质（母带）
node download.js 33894312 --out D:\music       # 指定保存目录（默认 ./downloads）
node download.js "稻香" --list                 # 只列出搜索结果，不下载
```

音质可选：`128k`、`320k`、`flac`（无损）、`flac24bit`（母带 / Hi-Res）。

---

## ❓ 常见问题（FAQ）

**Q1：LX 里「下载」按钮是灰色的？**
A：先确认①本地服务已启动（`http://127.0.0.1:3000/lx/health` 能打开）；②LX 设置里音源已选「网易云VIP音源」；③在列表里选中了具体歌曲（未选中任何歌曲时下载按钮不可用）。

**Q2：为什么下载弹窗最高只有「无损」，没有「母带」？**
A：这是 LX 2.12.2 自身对网易云母带等级的识别限制（详见上方「须知」第 4 条）。请使用「勾选歌曲 → 右键 → 下载 → 无损 - FLAC Hires」或 `download.js --quality flac24bit`。

**Q3：提示「无可用播放链接」？**
A：可能原因：该歌曲无版权 / 需要单独购买数字专辑 / 你的账号 VIP 已过期 / Cookie 失效。可执行 `node login.js --status` 检查登录状态，失效则重新 `node login.js`。

**Q4：切换音源后其他平台播放失败？**
A：正常现象，LX 音源是全局的。本音源只提供网易云，需要其他平台时请在 LX 设置里切回你原来的音源。

**Q5：端口 3000 被占用？**
A：设置环境变量后重启服务，例如 `set PORT=3100 && node server.js`，并同步修改 `lx-source-wyy.js` 顶部的 `API_BASE`，然后重新 `node install-source.js`。

**Q6：登录多久失效？**
A：Cookie 通常可维持较长时间。若失效，重新执行 `node login.js` 即可，无需重启服务（服务会实时读取最新 Cookie）。

---

## 🔒 隐私说明

- 账号 Cookie、二维码等敏感信息仅保存在本地 `data/` 目录，**不会上传任何服务器**。
- 仓库已通过 `.gitignore` 排除 `data/`、`node_modules/` 等目录，**不会把你的凭证提交到 GitHub**。请勿手动删除该规则并提交 `data/`。

---

## 📄 License

本项目仅供学习交流使用。所依赖的 [NeteaseCloudMusicApi](https://github.com/hudawei996/NeteaseCloudMusicApi) 遵循其原有开源协议（MIT），请一并遵守。