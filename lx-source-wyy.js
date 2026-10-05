/*!
 * @name 网易云VIP音源
 * @description 基于本地 NeteaseCloudMusicApi，支持 VIP 无损/母带
 * @version 1.0.0
 * @author lx-wyy
 * @homepage https://github.com/hudawei996/NeteaseCloudMusicApi
 */
'use strict'

const { EVENT_NAMES, request, on, send } = globalThis.lx

// 本地服务地址，需与 server.js 的端口一致（默认 3000）
const API_BASE = 'http://127.0.0.1:3000'

// LX 音质 -> 网易云 song/url/v1 的 level
const LEVEL_MAP = {
  '128k': 'standard',
  '320k': 'exhigh',
  flac: 'lossless',
  'flac24bit': 'hires',
}

// 音质降级顺序：高档不可用时依次尝试更低档
const LEVEL_FALLBACK = {
  standard: ['standard'],
  exhigh: ['exhigh', 'standard'],
  lossless: ['lossless', 'exhigh', 'standard'],
  hires: ['hires', 'lossless', 'exhigh', 'standard'],
}

const httpRequest = (url) =>
  new Promise((resolve, reject) => {
    request(url, { timeout: 15000 }, (err, resp) => {
      if (err) return reject(err)
      resolve(resp.body)
    })
  })

const getMusicUrl = (musicInfo, quality) => {
  const id = musicInfo.songmid || musicInfo.id
  if (!id) return Promise.reject(new Error('缺少歌曲 ID'))

  const levels = LEVEL_FALLBACK[LEVEL_MAP[quality] || 'standard'] || ['standard']

  const tryLevel = (index) => {
    if (index >= levels.length) return Promise.reject(new Error('无可用播放链接(可能无版权或登录已失效)'))
    const level = levels[index]
    return httpRequest(`${API_BASE}/song/url/v1?id=${id}&level=${level}`).then((body) => {
      const item = body && body.data && body.data[0]
      if (item && item.url) return item.url
      return tryLevel(index + 1)
    })
  }

  return tryLevel(0)
}

on(EVENT_NAMES.request, ({ source, action, info }) => {
  switch (action) {
    case 'musicUrl':
      return getMusicUrl(info.musicInfo, info.type)
    default:
      return Promise.reject(new Error('不支持的操作: ' + action))
  }
})

send(EVENT_NAMES.inited, {
  openDevTools: false,
  sources: {
    wy: {
      name: '网易云音乐',
      type: 'music',
      actions: ['musicUrl'],
      qualitys: ['128k', '320k', 'flac', 'flac24bit'],
    },
  },
})