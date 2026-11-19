// E2E 场景二：已有数据后"重新打开 App"（刷新）→ 解锁 → 新增条目。
// 复现用户真实路径：不是首次设置，而是带数据重启后操作。
import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:8080/'
const results = []
function check(name, cond, detail) { results.push({ name, ok: !!cond }); console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail !== undefined ? '  -> ' + detail : '')) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })
const warnings = []
page.on('console', m => { if (m.type() === 'warn' || m.type() === 'error') { const t = m.text(); if (t.includes('Failed to resolve component') || t.includes('pwd-input')) warnings.push(t) } })

// 点击 class 选择器元素的辅助函数
const clickCls = cls => page.evaluate(c => { const e = document.querySelector(c); if (e) e.click() }, cls)
const inputs = async () => page.$$('input.uni-input-input, textarea.uni-textarea-textarea, textarea')

try {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(1200)
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1200)

  console.log('\n===== 阶段一：首次设置，建立数据 =====')
  await clickCls('.primary-btn') // 首次使用
  await sleep(1200)
  let ins = await inputs()
  await ins[0].type('MyMaster2026Abc!')
  await ins[1].type('MyMaster2026Abc!')
  await sleep(300)
  await clickCls('.agree')
  await sleep(300)
  await clickCls('.primary-btn') // 完成设置
  await sleep(1800)
  check('首次设置进入密码库', page.url().includes('vault'), page.url())

  console.log('\n===== 阶段二：模拟重新打开 App（刷新浏览器）=====')
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1800)
  console.log('  刷新后 URL:', page.url())
  console.log('  刷新后文本:', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 250))
  check('刷新后回到解锁页', page.url().includes('index') || (await page.evaluate(() => document.body.innerText)).includes('解锁'), page.url())

  // 解锁页应有 1 个密码输入框（pwd-input）
  ins = await inputs()
  console.log('  解锁页 input 数:', ins.length, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('input')].map(i => ({type:i.type,cls:i.className})))) )
  check('解锁页存在密码输入框', ins.length >= 1, '数量=' + ins.length)

  const bodyUnlock = await page.evaluate(() => document.body.innerText)
  check('解锁页无组件解析失败的视觉症状（密码框已渲染）', ins.length >= 1)

  // 输入主密码解锁
  await ins[0].type('MyMaster2026Abc!')
  await sleep(300)
  await clickCls('.primary-btn') // 解锁按钮
  await sleep(1800)
  console.log('  解锁后 URL:', page.url())
  console.log('  解锁后文本:', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 250))
  check('解锁成功进入密码库', page.url().includes('vault'), page.url())

  console.log('\n===== 阶段三：新增条目并逐字段输入 =====')
  await clickCls('.add-btn')
  await sleep(1200)
  check('进入新增页', page.url().includes('detail'), page.url())
  ins = await inputs()
  console.log('  详情页 input 数:', ins.length)
  const vals = { site: 'gitlab.com', account: 'user@gitlab.com', url: 'https://gitlab.com', note: 'reopen test', pwd: 'N3w!Pass#2026' }
  await ins[0].type(vals.site)
  await ins[1].type(vals.account)
  await ins[2].type(vals.pwd)
  await ins[3].type(vals.url)
  await ins[4].type(vals.note)
  await sleep(300)
  const got = await page.evaluate(() => [...document.querySelectorAll('input,textarea')].map(i => i.value))
  console.log('  输入后所有值:', JSON.stringify(got))
  check('网站名输入生效', got[0] === vals.site, got[0])
  check('账号输入生效', got[1] === vals.account, got[1])
  check('密码输入生效', got[2] === vals.pwd, got[2])
  check('网址输入生效', got[3] === vals.url, got[3])
  check('备注输入生效', got[4] === vals.note, got[4])

  await clickCls('.primary-btn') // 保存
  await sleep(1500)
  const after = await page.evaluate(() => document.body.innerText)
  check('保存后列表出现新条目', after.includes('gitlab.com'), '')
  console.log('  保存后文本:', after.replace(/\s+/g, ' ').slice(0, 250))

  console.log('\n===== 组件解析警告 =====')
  if (warnings.length) warnings.forEach(w => console.log('  ' + w.slice(0, 160)))
  else console.log('  无 pwd-input 解析失败警告')
  check('无组件解析失败警告', warnings.length === 0, '数量=' + warnings.length)

} catch (e) {
  console.log('E2E 异常:', e && e.stack ? e.stack : e)
  check('E2E 流程无异常', false, String(e))
} finally {
  const pass = results.filter(r => r.ok).length
  console.log('\n===== 汇总 =====')
  console.log('通过 ' + pass + ' / ' + results.length)
  results.filter(r => !r.ok).forEach(r => console.log('  FAIL  ' + r.name))
  await browser.close()
  process.exit(pass === results.length ? 0 : 1)
}
