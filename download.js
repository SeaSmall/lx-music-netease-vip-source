/**
 * 网易云音乐下载脚本（VIP 生效）
 *
 * 用法:
 *   node download.js 33894312                 下载指定歌曲 ID
 *   node download.js 33894312 1234567         批量下载多个 ID
 *   node download.js "周杰伦 稻香"             按关键词搜索并下载第一个结果
 *   node download.js "稻香" --quality flac     指定音质(128k/320k/flac/flac24bit)
 *   node download.js 33894312 --out D:\music  指定保存目录（默认 ./downloads）
 *   node download.js "稻香" --list            只列出搜索结果，不下载
 */
'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const ncm = require('NeteaseCloudMusicApi')

const COOKIE_FILE = path.join(__dirname, 'data', 'cookie.json')
const LEVEL_MAP = { '128k': 'standard', '320k': 'exhigh', flac: 'lossless', flac24bit: 'hires' }
const LEVEL_FALLBACK = {
  standard: ['standard'],
  exhigh: ['exhigh', 'standard'],
  lossless: ['lossless', 'exhigh', 'standard'],
  hires: ['hires', 'lossless', 'exhigh', 'standard'],
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        args[key] = next
        i++
      } else {
        args[key] = true
      }
    } else args._.push(a)
  }
  return args
}

function readCookie() {
  try {
    const raw = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'))
    return typeof raw === 'string' ? raw : raw.cookie || ''
  } catch (e) {
    return ''
  }
}

function sanitize(name) {
  return String(name || 'unknown').replace(/[\\/:*?"<>|\r\n]/g, '_').trim()
}

function joinSingers(ar) {
  return (ar || []).map((a) => a.name).join('、') || '未知歌手'
}

async function fetchDetail(id, cookie) {
  const res = await ncm.song_detail({ ids: String(id), cookie })
  const song = res && res.body && res.body.songs && res.body.songs[0]
  if (!song) throw new Error('获取歌曲信息失败: ' + id)
  return { id, name: song.name, singer: joinSingers(song.ar), album: (song.al && song.al.name) || '' }
}

async function search(keyword, cookie, listOnly) {
  const res = await ncm.cloudsearch({ keywords: keyword, type: 1, limit: 10, cookie })
  const songs = (res && res.body && res.body.result && res.body.result.songs) || []
  if (!songs.length) throw new Error('未搜索到结果: ' + keyword)
  if (listOnly) {
    console.log(`搜索「${keyword}」结果:`)
    songs.forEach((s, i) => {
      console.log(`  [${i}] id=${s.id}  ${s.name} - ${joinSingers(s.ar)}  《${(s.al && s.al.name) || ''}》`)
    })
    return null
  }
  const top = songs[0]
  console.log(`搜索「${keyword}」-> 选中: ${top.name} - ${joinSingers(top.ar)} (id=${top.id})`)
  return top.id
}

async function getUrl(id, level, cookie) {
  const levels = LEVEL_FALLBACK[level] || ['standard']
  for (const lv of levels) {
    const res = await ncm.song_url_v1({ id, level: lv, cookie })
    const item = res && res.body && res.body.data && res.body.data[0]
    if (item && item.url) return { url: item.url, level: lv, size: item.size, br: item.br }
  }
  return null
}

function guessExt(url, level) {
  const m = /\.([a-z0-9]+)(?:\?|$)/i.exec(url || '')
  if (m && /^(mp3|flac|m4a|aac|wav)$/i.test(m[1])) return m[1].toLowerCase()
  if (level === 'lossless' || level === 'hires') return 'flac'
  return 'mp3'
}

function downloadFile(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 6) return reject(new Error('重定向次数过多'))
    const mod = url.startsWith('https:') ? https : http
    const req = mod.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          return resolve(downloadFile(res.headers.location, dest, depth + 1))
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error('下载失败 HTTP ' + res.statusCode))
        }
        const total = Number(res.headers['content-length'] || 0)
        let received = 0
        let lastLog = 0
        const out = fs.createWriteStream(dest)
        res.on('data', (chunk) => {
          received += chunk.length
          const now = Date.now()
          if (now - lastLog > 500) {
            lastLog = now
            const pct = total ? ((received / total) * 100).toFixed(1) + '%' : received + 'B'
            process.stdout.write(`\r  下载中... ${pct}      `)
          }
        })
        res.pipe(out)
        out.on('finish', () => {
          process.stdout.write('\r')
          resolve({ size: received })
        })
        out.on('error', reject)
        res.on('error', reject)
      },
    )
    req.on('error', reject)
    req.setTimeout(30000, () => req.destroy(new Error('下载超时')))
  })
}

async function downloadLyric(id, basePath, cookie) {
  try {
    const res = await ncm.lyric({ id, cookie })
    const lrc = res && res.body && res.body.lrc && res.body.lrc.lyric
    if (lrc) {
      fs.writeFileSync(basePath + '.lrc', lrc, 'utf8')
      return true
    }
  } catch (e) {
    /* 忽略歌词失败 */
  }
  return false
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cookie = readCookie()
  if (!cookie) {
    console.error('未找到 Cookie，请先运行: node login.js')
    process.exitCode = 1
    return
  }
  if (!args._.length) {
    console.error('请提供歌曲 ID 或搜索关键词。示例: node download.js "周杰伦 稻香"')
    process.exitCode = 1
    return
  }

  const quality = args.quality || 'flac'
  const level = LEVEL_MAP[quality] || 'lossless'
  const outDir = args.out || path.join(__dirname, 'downloads')
  fs.mkdirSync(outDir, { recursive: true })

  const ids = []
  for (const item of args._) {
    if (/^\d+$/.test(item)) ids.push(Number(item))
    else {
      const found = await search(item, cookie, !!args.list)
      if (found) ids.push(Number(found))
    }
  }
  if (args.list) return

  let ok = 0
  for (const id of ids) {
    try {
      const detail = await fetchDetail(id, cookie)
      console.log(`\n[${id}] ${detail.name} - ${detail.singer}`)
      const info = await getUrl(id, level, cookie)
      if (!info) {
        console.error('  未获取到播放链接（可能无版权 / VIP 失效）')
        continue
      }
      const ext = guessExt(info.url, info.level)
      const fileName = sanitize(`${detail.name} - ${detail.singer}`) + '.' + ext
      const dest = path.join(outDir, fileName)
      const { size } = await downloadFile(info.url, dest)
      console.log(`  完成: ${dest} (${(size / 1024 / 1024).toFixed(2)} MB, level=${info.level})`)
      if (!args['no-lrc']) await downloadLyric(id, path.join(outDir, sanitize(`${detail.name} - ${detail.singer}`)), cookie)
      ok++
    } catch (err) {
      console.error(`  [${id}] 失败:`, err && err.message ? err.message : err)
    }
  }
  console.log(`\n全部完成，成功 ${ok}/${ids.length} 首。保存目录: ${outDir}`)
}

main().catch((err) => {
  console.error('发生错误:', err && err.message ? err.message : err)
  process.exitCode = 1
})