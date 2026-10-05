/**
 * 本地网易云音乐 API 服务
 *
 * 基于 NeteaseCloudMusicApi，暴露其全部接口，并在服务端自动注入已登录账号的
 * Cookie（VIP 生效的关键）。这样 LX 音源脚本与下载脚本都无需自行携带 Cookie。
 *
 * 启动:  node server.js           (默认 http://127.0.0.1:3000)
 * 端口:  环境变量 PORT / HOST 可覆盖
 */
'use strict'

const express = require('express')
const fs = require('fs')
const path = require('path')
const ncm = require('NeteaseCloudMusicApi')

const DATA_DIR = path.join(__dirname, 'data')
const COOKIE_FILE = path.join(DATA_DIR, 'cookie.json')

const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '127.0.0.1'

// 每次请求都重新读取 Cookie 文件，这样重新登录后无需重启服务
let cookieCache = { mtimeMs: 0, value: '' }
function getCookie() {
  try {
    const stat = fs.statSync(COOKIE_FILE)
    if (stat.mtimeMs !== cookieCache.mtimeMs) {
      const raw = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'))
      const value =
        typeof raw === 'string' ? raw : (raw && typeof raw.cookie === 'string' ? raw.cookie : '')
      cookieCache = { mtimeMs: stat.mtimeMs, value }
    }
  } catch (e) {
    cookieCache = { mtimeMs: 0, value: '' }
  }
  return cookieCache.value
}

const app = express()
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ extended: false, limit: '20mb' }))

// LX 音源脚本 / 下载脚本可直接跑，不需要浏览器跨域；这里仍放开方便调试
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Headers', '*')
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

// 健康检查：查看服务与登录状态
app.get('/lx/health', (req, res) => {
  const cookie = getCookie()
  res.json({
    ok: true,
    port: PORT,
    loggedIn: /MUSIC_U=/.test(cookie),
    cookieLength: cookie.length,
    cookieUpdatedAt: (() => {
      try {
        return JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8')).updatedAt || null
      } catch (e) {
        return null
      }
    })(),
  })
})

// 不需要作为普通接口暴露的导出
const SKIP = new Set(['server', 'serveNcmApi', 'getModulesDefinitions', 'default'])

let routeCount = 0
for (const name of Object.keys(ncm)) {
  if (typeof ncm[name] !== 'function' || SKIP.has(name)) continue
  // NCM 的命名约定: song_url_v1.js -> /song/url/v1
  const route = '/' + name.replace(/_/g, '/')
  app.all(route, async (req, res) => {
    const query = Object.assign({}, req.query, req.body)
    // 未显式传 cookie 时，注入本地已登录的 VIP Cookie
    if (!query.cookie) query.cookie = getCookie()
    try {
      const result = await ncm[name](query)
      const status = result && result.status ? result.status : 200
      const body = result && result.body !== undefined ? result.body : result
      res.status(status).send(body)
    } catch (err) {
      const status = (err && err.status) || 500
      const body = (err && err.body) || { code: 500, msg: String((err && err.message) || err) }
      res.status(status).send(body)
    }
  })
  routeCount++
}

app.use((req, res) => {
  res.status(404).json({ code: 404, msg: 'Not Found: ' + req.path })
})

const server = app.listen(PORT, HOST, () => {
  const cookie = getCookie()
  console.log('==============================================')
  console.log(' 网易云音乐 API 服务已启动')
  console.log(` 地址: http://${HOST}:${PORT}`)
  console.log(` 接口数: ${routeCount}`)
  console.log(` 登录状态: ${/MUSIC_U=/.test(cookie) ? '已登录 (VIP Cookie 已加载)' : '未登录 (请先运行 node login.js)'}`)
  console.log('==============================================')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用，请关闭占用程序或设置环境变量 PORT 后重试。`)
  } else {
    console.error(err)
  }
  process.exit(1)
})