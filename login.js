/**
 * 网易云音乐登录脚本（用于获取 VIP Cookie）
 *
 * 用法:
 *   node login.js                     扫码登录（推荐，默认）
 *   node login.js --phone 138xxxx --password xxx      手机号+密码登录
 *   node login.js --phone 138xxxx --send              发送短信验证码
 *   node login.js --phone 138xxxx --captcha 1234      手机号+短信验证码登录
 *   node login.js --status            查看当前登录状态
 *   node login.js --logout            清除本地已保存的 Cookie
 *
 * 登录成功后 Cookie 会保存到 data/cookie.json，server.js 会自动读取。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const QRCode = require('qrcode')
const ncm = require('NeteaseCloudMusicApi')

const DATA_DIR = path.join(__dirname, 'data')
const COOKIE_FILE = path.join(DATA_DIR, 'cookie.json')
const QR_FILE = path.join(DATA_DIR, 'qrcode.png')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    } else {
      args._.push(a)
    }
  }
  return args
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readCookie() {
  try {
    const raw = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf8'))
    return typeof raw === 'string' ? raw : raw.cookie || ''
  } catch (e) {
    return ''
  }
}

function cleanCookie(raw) {
  if (!raw) return ''
  const attrs = /^(max-age|expires|path|domain|samesite|secure|httponly|version|comment)$/i
  const map = new Map()
  for (const token of String(raw).split(';')) {
    const idx = token.indexOf('=')
    if (idx < 1) continue
    const k = token.slice(0, idx).trim()
    const v = token.slice(idx + 1).trim()
    if (!k || attrs.test(k)) continue
    map.set(k, v)
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

function saveCookie(cookie, profile) {
  ensureDataDir()
  cookie = cleanCookie(cookie)
  fs.writeFileSync(
    COOKIE_FILE,
    JSON.stringify(
      {
        cookie,
        updatedAt: new Date().toISOString(),
        nickname: profile ? profile.nickname : undefined,
        userId: profile ? profile.userId : undefined,
        vipType: profile ? profile.vipType : undefined,
      },
      null,
      2,
    ),
    'utf8',
  )
  fs.writeFileSync(path.join(DATA_DIR, 'cookie.txt'), cookie, 'utf8')
}

function openFile(file) {
  if (process.platform === 'win32') {
    exec(`start "" "${file}"`, () => {})
  } else if (process.platform === 'darwin') {
    exec(`open "${file}"`, () => {})
  } else {
    exec(`xdg-open "${file}"`, () => {})
  }
}

function maskCookie(cookie) {
  return cookie.replace(/MUSIC_U=[^;]+/, 'MUSIC_U=****(已隐藏)')
}

async function showStatus(cookie) {
  if (!cookie) {
    console.log('当前未登录。请运行: node login.js 进行扫码登录')
    return
  }
  const res = await ncm.login_status({ cookie })
  const data = (res && res.body && res.body.data) || {}
  const profile = data.profile
  if (!profile) {
    console.log('Cookie 已失效或未登录，请重新运行: node login.js')
    return
  }
  const vip = profile.vipType ? `VIP 已开通 (vipType=${profile.vipType})` : '普通用户(无 VIP)'
  console.log('当前登录账号:')
  console.log('  昵称     :', profile.nickname)
  console.log('  用户 ID  :', profile.userId)
  console.log('  VIP 状态 :', vip)
  try {
    const v = await ncm.vip_info({ cookie })
    const pkg = v && v.body && v.body.data && v.body.data.musicPackage
    if (pkg && pkg.expireTime) console.log('  会员到期 :', new Date(pkg.expireTime).toLocaleString())
  } catch (e) {
    /* 忽略 */
  }
  console.log('  Cookie   :', maskCookie(cookie))
}

async function loginByQr() {
  console.log('正在生成登录二维码...')
  const keyRes = await ncm.login_qr_key({})
  const unikey = keyRes && keyRes.body && keyRes.body.data && keyRes.body.data.unikey
  if (!unikey) throw new Error('获取二维码 key 失败: ' + JSON.stringify(keyRes && keyRes.body))

  const qrRes = await ncm.login_qr_create({ key: unikey, qrimg: true })
  const data = (qrRes && qrRes.body && qrRes.body.data) || {}
  const qrurl = data.qrurl
  const qrimg = data.qrimg

  if (qrimg && /^data:image\/png;base64,/.test(qrimg)) {
    ensureDataDir()
    fs.writeFileSync(QR_FILE, Buffer.from(qrimg.split(',')[1], 'base64'))
  }

  try {
    const text = await QRCode.toString(qrurl, { type: 'terminal', small: true })
    console.log(text)
  } catch (e) {
    /* 终端二维码渲染失败时忽略 */
  }
  if (fs.existsSync(QR_FILE)) {
    console.log('二维码图片已保存并尝试打开:', QR_FILE)
    openFile(QR_FILE)
  }
  console.log('请使用「网易云音乐」App 扫描二维码并在手机上确认登录...')

  const cookieFromKey = (keyRes.cookie || []).join('; ')

  for (let i = 0; i < 60; i++) {
    await sleep(3000)
    let check
    try {
      check = await ncm.login_qr_check({ key: unikey, cookie: cookieFromKey || 'os=pc' })
    } catch (e) {
      continue
    }
    const body = (check && check.body) || {}
    const code = body.code
    if (code === 800) {
      console.log('\n二维码已过期，正在重新生成...')
      return loginByQr()
    }
    if (code === 801) {
      process.stdout.write('\r等待扫码...   ')
      continue
    }
    if (code === 802) {
      process.stdout.write('\r已扫码，请在手机上点击确认...   ')
      continue
    }
    if (code === 803) {
      const cookie = body.cookie || (check.cookie || []).join('; ')
      if (!/MUSIC_U=/.test(cookie)) {
        console.log('\n登录返回的 Cookie 异常，请重试。')
        return false
      }
      console.log('\n登录成功！')
      await showStatus(cookie)
      const status = await ncm.login_status({ cookie })
      saveCookie(cookie, (status.body && status.body.data && status.body.data.profile) || null)
      console.log('Cookie 已保存到:', COOKIE_FILE)
      return true
    }
  }
  console.log('\n扫码超时，请重新运行: node login.js')
  return false
}

async function loginByPhone(phone, password, captcha) {
  const query = { phone, countrycode: '86' }
  if (captcha) query.captcha = captcha
  else query.password = password

  const res = await ncm.login_cellphone(query)
  const body = res && res.body ? res.body : {}
  if (body.code === 200) {
    const cookie = body.cookie || (res.cookie || []).join('; ')
    console.log('登录成功！')
    const status = await ncm.login_status({ cookie })
    const profile = (status.body && status.body.data && status.body.data.profile) || null
    if (profile) {
      console.log('  昵称   :', profile.nickname)
      console.log('  VIP    :', profile.vipType ? `已开通 (vipType=${profile.vipType})` : '普通用户')
    }
    saveCookie(cookie, profile)
    console.log('Cookie 已保存到:', COOKIE_FILE)
    return true
  }
  console.error('登录失败:', body.code, body.message || body.msg || '')
  if (body.code === 501 || /验证码|captcha/i.test(JSON.stringify(body))) {
    console.error('该账号需要短信验证码，请先执行: node login.js --phone <手机号> --send')
    console.error('再执行: node login.js --phone <手机号> --captcha <收到的验证码>')
  }
  return false
}

async function sendCaptcha(phone) {
  const res = await ncm.captcha_sent({ phone, ctcode: '86' })
  const body = res && res.body ? res.body : {}
  if (body.code === 200) {
    console.log('短信验证码已发送，请查收后执行:')
    console.log(`  node login.js --phone ${phone} --captcha <验证码>`)
    return true
  }
  console.error('发送验证码失败:', body.code, body.message || body.msg || '')
  return false
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  ensureDataDir()

  if (args.status) return void (await showStatus(readCookie()))

  if (args.logout) {
    if (fs.existsSync(COOKIE_FILE)) fs.unlinkSync(COOKIE_FILE)
    const txt = path.join(DATA_DIR, 'cookie.txt')
    if (fs.existsSync(txt)) fs.unlinkSync(txt)
    console.log('已清除本地 Cookie。')
    return
  }

  if (args.phone && args.send) return void (await sendCaptcha(args.phone))
  if (args.phone) {
    if (args.captcha) return void (await loginByPhone(args.phone, null, args.captcha))
    if (args.password) return void (await loginByPhone(args.phone, args.password, null))
    console.error('请提供 --password 或 --captcha。')
    process.exitCode = 1
    return
  }

  const ok = await loginByQr()
  if (!ok) process.exitCode = 1
}

main().catch((err) => {
  console.error('发生错误:', err && err.message ? err.message : err)
  process.exitCode = 1
})