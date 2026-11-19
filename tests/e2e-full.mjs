// 全量 E2E：在真实 Chrome 里遍历所有页面与关键交互，捕获所有组件解析失败/JS 异常。
// 目标：主动发现所有"无法输入/无法点击/组件缺失"类问题，而不是等用户报告。
import puppeteer from 'puppeteer-core'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:8080/'
const results = []
function check(name, cond, detail) { results.push({ name, ok: !!cond }); console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail !== undefined ? '  -> ' + detail : '')) }
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })

// 全局捕获所有"组件解析失败"和 JS 异常，按页面归因
const componentErrors = []
const jsErrors = []
page.on('console', m => {
  const t = m.text()
  if (t.includes('Failed to resolve component')) componentErrors.push(t)
})
page.on('pageerror', e => jsErrors.push(e.message))

const clickCls = cls => page.evaluate(c => { const e = document.querySelector(c); if (e) { e.click(); return true } return false }, cls)
const inputs = async () => page.$$('input.uni-input-input, textarea.uni-textarea-textarea, textarea')
const text = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
const goto = async (hash) => { await page.evaluate(h => { location.hash = h }, hash); await sleep(1000) }

try {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(1200)
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1200)

  console.log('\n===== 建立测试数据：首次设置 + 2 条密码 =====')
  await clickCls('.primary-btn'); await sleep(1200)
  let ins = await inputs()
  await ins[0].type('MyMaster2026Abc!'); await ins[1].type('MyMaster2026Abc!'); await sleep(200)
  await clickCls('.agree'); await sleep(200)
  await clickCls('.primary-btn'); await sleep(1500)
  check('进入密码库', page.url().includes('vault'), '')
  // 加 2 条数据
  for (const item of [{ s: 'github.com', a: 'dev@x.com', p: 'Str0ng!Pass#1' }, { s: 'bank.com', a: 'user2', p: 'weak' }]) {
    await clickCls('.add-btn'); await sleep(1000)
    ins = await inputs()
    await ins[0].type(item.s); await ins[1].type(item.a); await ins[2].type(item.p); await sleep(200)
    await clickCls('.primary-btn'); await sleep(1000)
  }
  check('列表有 2 条数据', (await text()).includes('github.com') && (await text()).includes('bank.com'), (await text()).slice(0, 150))

  console.log('\n===== 搜索功能 =====')
  ins = await inputs()
  await ins[0].type('github'); await sleep(500)
  const searchText = await text()
  check('搜索 github 只显示匹配项', searchText.includes('github.com') && !searchText.includes('bank.com'), searchText.slice(0, 150))
  // 清空搜索
  await page.evaluate(() => { const e = document.querySelector('input.uni-input-input'); if (e) { e.value=''; e.dispatchEvent(new Event('input',{bubbles:true})) } }); await sleep(400)

  console.log('\n===== 编辑已有条目 =====')
  // 点击列表第一项（.pwd-item 里的 open 区域）
  const opened = await page.evaluate(() => { const e = document.querySelector('.entry-card'); if (e) { e.click(); return true } return false })
  await sleep(1000)
  if (opened) {
    check('打开编辑页', page.url().includes('detail'), page.url())
    ins = await inputs()
    const beforeSite = await page.evaluate(() => document.querySelector('input.uni-input-input')?.value)
    // 修改网站名
    await page.evaluate(() => { const e=document.querySelector('input.uni-input-input'); if(e){e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))}})
    await ins[0].type('github-modified.com'); await sleep(300)
    const afterSite = await page.evaluate(() => document.querySelector('input.uni-input-input')?.value)
    check('编辑页字段可修改', afterSite === 'github-modified.com', '原=' + beforeSite + ' 新=' + afterSite)
    // 不保存，返回
    await page.evaluate(() => history.back()); await sleep(1000)
  } else {
    check('列表项可点击', false, '未找到 .entry-card')
  }

  console.log('\n===== Tab 页面：体检 / 同步 / 设置 =====')
  await goto('#/pages/health/health')
  check('体检页渲染', (await text()).includes('安全') || (await text()).includes('弱密码') || (await text()).includes('分'), (await text()).slice(0, 120))

  await goto('#/pages/sync/sync')
  const syncText = await text()
  check('同步页渲染', syncText.includes('同步') || syncText.includes('本地'), syncText.slice(0, 120))
  // 同步页两个输入框输入测试
  ins = await inputs()
  if (ins.length >= 2) {
    await ins[0].type('test@example.com'); await ins[1].type('secret'); await sleep(300)
    const sv = await page.evaluate(() => [...document.querySelectorAll('input')].map(i=>i.value))
    check('同步页账号/凭证可输入', sv.some(v=>v==='test@example.com') && sv.some(v=>v==='secret'), JSON.stringify(sv))
  } else check('同步页输入框存在', false, '数量=' + ins.length)

  await goto('#/pages/settings/settings')
  check('设置页渲染', (await text()).includes('主密码') || (await text()).includes('自动锁定'), (await text()).slice(0, 120))

  console.log('\n===== 子页面：分类 / 标签 / 导入导出 / 提醒 / 生成器 =====')
  for (const [hash, key, addCls] of [
    ['#/pages/category/category', '分类', '.add-btn'],
    ['#/pages/tag/tag', '标签', '.add-btn']
  ]) {
    await goto(hash)
    ins = await inputs()
    check(key + '页有输入框', ins.length >= 1, '数量=' + ins.length)
    if (ins.length >= 1) {
      await ins[0].type('测试' + key); await sleep(200)
      const v = await page.evaluate(() => document.querySelector('input.uni-input-input')?.value)
      check(key + '页输入框可输入', v === '测试' + key, v)
      await clickCls(addCls); await sleep(600)
      check(key + '新增成功', (await text()).includes('测试' + key), (await text()).slice(0, 120))
    }
  }

  await goto('#/pages/import-export/import-export')
  ins = await inputs()
  console.log('  导入导出页 input 数:', ins.length)
  check('导入导出页有密码输入框', ins.length >= 1, '数量=' + ins.length)
  if (ins.length >= 1) {
    await ins[0].type('MyMaster2026Abc!'); await sleep(200)
    await clickCls('.primary-btn'); await sleep(600) // 导出
    const ioText = await text()
    check('导出生成备份内容', ioText.includes('PVBACKUP') || ioText.includes('备份') || (await page.evaluate(() => !!document.querySelector('.result'))), ioText.slice(0, 120))
  }

  await goto('#/pages/reminders/reminders')
  check('提醒页渲染', (await text()).includes('提醒') || (await text()).includes('规则') || (await text()).includes('暂无'), (await text()).slice(0, 120))

  await goto('#/pages/generator/generator')
  await clickCls('.primary-btn'); await sleep(500) // 生成
  const genText = await text()
  check('生成器页生成密码', genText.length > 20, genText.slice(0, 120))

  console.log('\n===== 全局异常汇总 =====')
  if (componentErrors.length) componentErrors.forEach(e => console.log('  组件错误: ' + e.slice(0, 180)))
  else console.log('  无组件解析失败')
  if (jsErrors.length) jsErrors.forEach(e => console.log('  JS异常: ' + e.slice(0, 180)))
  else console.log('  无 JS 异常')
  check('无组件解析失败', componentErrors.length === 0, '数量=' + componentErrors.length)
  check('无 JS 异常', jsErrors.length === 0, '数量=' + jsErrors.length)

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
