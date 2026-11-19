#!/usr/bin/env node
/**
 * 持久监听 DCloud 云打包队列，打包完成后自动取下载链接并下载 APK。
 * 用法：node tools/watch-and-fetch-apk.mjs
 * 依赖 HBuilderX CLI 已登录、项目已导入、云端已有排队/打包任务。
 */
import { execFileSync } from 'child_process'
import { writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const CLI = 'D:/download/HBuilderX/cli.exe'
const PROJECT = ROOT
const APK_DIR = join(ROOT, 'dist', 'release', 'apk')
const APK_NAME = 'pwd-v1.0.0-100.apk'
const URL_RE = /https?:\/\/[^\s"'<>）)]+\/build\/download\/[^\s"'<>）)]+/g
const POLL_MS = 60 * 1000
const MAX_MS = 4 * 60 * 60 * 1000

function log(msg) { console.log('[' + new Date().toLocaleTimeString('zh-CN') + '] ' + msg) }

function queryStatus() {
  try {
    return execFileSync(CLI, ['pack', 'status', '--project', PROJECT], { encoding: 'utf8', timeout: 60000 })
  } catch (e) {
    return String(e.stdout || e.message || '')
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function download(url, dest) {
  mkdirSync(dirname(dest), { recursive: true })
  log('下载 APK: ' + url)
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const buf = Buffer.from(await res.arrayBuffer())
  // 校验是 ZIP（APK 本质是 zip，头部 PK）
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error('下载内容不是有效 APK(zip)')
  writeFileSync(dest, buf)
  log('已保存: ' + dest + ' (' + (buf.length / 1048576).toFixed(1) + ' MB)')
  return dest
}

async function main() {
  log('开始监听云打包任务（每 ' + (POLL_MS / 1000) + 's 查询一次，最长 ' + (MAX_MS / 3600000) + 'h）')
  const start = Date.now()
  let lastQueue = ''
  while (Date.now() - start < MAX_MS) {
    const out = queryStatus()
    const urls = [...new Set(out.match(URL_RE) || [])]
    const queueMatch = out.match(/(\d+)(?:th|st|nd|rd)?\s+place in the queue|第\s*(\d+)\s*位/)
    const queue = queueMatch ? (queueMatch[1] || queueMatch[2]) : ''
    if (queue && queue !== lastQueue) { log('队列位置: ' + queue); lastQueue = queue }

    if (/打包成功|pack success|下载|download|完成|success/i.test(out) && urls.length) {
      log('检测到打包完成，发现下载链接')
      const dest = join(APK_DIR, APK_NAME)
      try {
        await download(urls[0], dest)
        writeFileSync(join(ROOT, '.apk-ready'), 'ready:' + new Date().toISOString() + '\n' + dest)
        log('APK_READY: ' + dest)
        process.exit(0)
      } catch (e) {
        log('下载失败: ' + e.message + '，链接: ' + urls[0])
        writeFileSync(join(ROOT, '.apk-url'), urls[0])
      }
    }
    if (/打包失败|打包出错|操作失败|用户取消|AppID is not valid/i.test(out) && !queue) {
      log('检测到打包失败或取消，停止监听')
      process.exit(2)
    }
    await sleep(POLL_MS)
  }
  log('监听超时，未检测到打包完成')
  process.exit(3)
}
main().catch(e => { log('异常: ' + e.stack); process.exit(1) })
