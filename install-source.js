/**
 * 将 lx-source-wyy.js 安装为 LX Music 的自定义音源
 *
 * 用法:
 *   node install-source.js              安装/更新音源（需先关闭 LX Music）
 *   node install-source.js --default    同时把它设为 LX 当前使用的音源
 *   node install-source.js --dry-run    只预览，不写入
 *
 * 原理: LX Music 把自定义音源以 "gz_" + base64(zlib.deflate(源码)) 的形式
 *       存放在 LxDatas/user_api.json 中，这里按同样格式写入。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { execSync } = require('child_process')

const SOURCE_FILE = path.join(__dirname, 'lx-source-wyy.js')

function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    if (a.startsWith('--')) args[a.slice(2)] = true
  }
  return args
}

function getLxDataDir() {
  const base = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming')
  return path.join(base, 'lx-music-desktop', 'LxDatas')
}

function isLxRunning() {
  if (process.platform !== 'win32') return false
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq lx-music-desktop.exe" /NH', {
      encoding: 'utf8',
      windowsHide: true,
    })
    return /lx-music-desktop\.exe/i.test(out)
  } catch (e) {
    return false
  }
}

function parseMeta(script) {
  const meta = {}
  const m = script.match(/\/\*!?([\s\S]*?)\*\//)
  if (m) {
    for (const line of m[1].split('\n')) {
      const mm = /@(\w+)\s+(.+)/.exec(line)
      if (mm) meta[mm[1]] = mm[2].trim()
    }
  }
  return meta
}

function compress(script) {
  return 'gz_' + zlib.deflateSync(Buffer.from(script, 'utf8')).toString('base64')
}

function backup(file) {
  const dest = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`
  fs.copyFileSync(file, dest)
  return dest
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!fs.existsSync(SOURCE_FILE)) {
    console.error('找不到音源文件:', SOURCE_FILE)
    process.exitCode = 1
    return
  }
  const script = fs.readFileSync(SOURCE_FILE, 'utf8')
  const meta = parseMeta(script)
  if (!meta.name) {
    console.error('音源文件缺少 @name 头注释，无法安装。')
    process.exitCode = 1
    return
  }

  const dataDir = args['data-dir'] ? path.resolve(args['data-dir']) : getLxDataDir()
  const userApiFile = path.join(dataDir, 'user_api.json')
  const configFile = path.join(dataDir, 'config_v2.json')

  if (!fs.existsSync(userApiFile)) {
    console.error('找不到 LX 数据文件:', userApiFile)
    console.error('请确认已安装并至少运行过一次 LX Music。')
    process.exitCode = 1
    return
  }

  if (isLxRunning() && !args['dry-run']) {
    console.error('检测到 LX Music 正在运行，请先完全退出 LX Music 后再执行本脚本，')
    console.error('否则退出时 LX 会用内存中的旧数据覆盖写入的内容。')
    process.exitCode = 1
    return
  }

  const store = JSON.parse(fs.readFileSync(userApiFile, 'utf8'))
  if (!Array.isArray(store.userApis)) store.userApis = []

  const compressed = compress(script)
  let entry = store.userApis.find((u) => u.name === meta.name)
  let action
  if (entry) {
    Object.assign(entry, {
      description: meta.description || '',
      version: meta.version || '1.0.0',
      author: meta.author || '',
      homepage: meta.homepage || '',
      allowShowUpdateAlert: false,
      script: compressed,
    })
    action = '更新'
  } else {
    const id = `user_api_${Math.floor(Math.random() * 900 + 100)}_${Date.now()}`
    entry = {
      id,
      name: meta.name,
      description: meta.description || '',
      version: meta.version || '1.0.0',
      author: meta.author || '',
      homepage: meta.homepage || '',
      allowShowUpdateAlert: false,
      script: compressed,
    }
    store.userApis.push(entry)
    action = '新增'
  }

  const setDefault = !!args.default
  console.log(`音源「${meta.name}」${action}成功 (id=${entry.id})`)
  console.log('  user_api.json :', userApiFile)
  if (setDefault) console.log('  并设为当前音源 -> config_v2.json')

  if (args['dry-run']) {
    console.log('\n[dry-run] 未写入任何文件。')
    return
  }

  const bak1 = backup(userApiFile)
  fs.writeFileSync(userApiFile, JSON.stringify(store), 'utf8')
  console.log('  已备份原文件:', bak1)

  if (setDefault && fs.existsSync(configFile)) {
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    if (cfg.setting) cfg.setting['common.apiSource'] = entry.id
    const bak2 = backup(configFile)
    fs.writeFileSync(configFile, JSON.stringify(cfg, null, '\t'), 'utf8')
    console.log('  已备份原文件:', bak2)
  }

  console.log('\n安装完成。打开 LX Music 后:')
  console.log('  设置 -> 音源(自定义源) -> 选择「' + meta.name + '」')
  console.log('  搜索时把音乐来源切到「网易音乐(wy)」即可播放/下载 VIP 音质。')
}

main()