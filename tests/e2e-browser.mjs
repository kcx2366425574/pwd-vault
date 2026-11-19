// 真实浏览器 E2E：用系统 Chrome 跑通完整主流程，验证所有输入控件真实可交互。
// 运行前需先 npm run dev:h5（默认 http://localhost:8080/）。
import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = 'http://localhost:8080/'

const results = []
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail })
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail !== undefined ? '  -> ' + detail : ''))
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844 })

// 收集控制台错误与页面异常
const pageErrors = []
page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') pageErrors.push('console.error: ' + m.text()) })

try {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(1500)

  // 清理之前的测试数据（localStorage），保证从首次使用开始
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle2' })
  await sleep(1500)

  console.log('\n===== 1. 首页 / 首次设置入口 =====')
  const bodyText1 = await page.evaluate(() => document.body.innerText)
  check('首页显示「首次使用」入口', bodyText1.includes('首次使用'), bodyText1.slice(0, 100))
  console.log('  当前 URL:', page.url())
  console.log('  页面文本:', bodyText1.replace(/\s+/g, ' ').slice(0, 200))

  // 点击「首次使用 · 设置主密码」
  const clickedSetup = await page.evaluate(() => {
    const t = document.querySelector('.primary-btn')
    if (t) { t.click(); return t.tagName + '.' + t.className }
    return null
  })
  check('点击首次使用入口', !!clickedSetup, clickedSetup)
  await sleep(1500)
  console.log('  当前 URL:', page.url())
  console.log('  页面文本:', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300))

  console.log('\n===== 2. 设置主密码页：输入 15 位密码 =====')
  // 找到 setup 页的两个密码输入框（uni-app input 渲染为 input 元素）
  const inputsBefore = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => ({ type: i.type, placeholder: i.placeholder, cls: i.className })))
  console.log('  input 元素:', JSON.stringify(inputsBefore))

  // 用真实键盘输入（聚焦第一个可见 input）
  const pwdInputs = await page.$$('input')
  console.log('  可输入 input 数量:', pwdInputs.length)
  // uni-app 原生 input 的 placeholder 未透传，改用 class 选择器按 DOM 顺序取
  const setupPwd = (await page.$$('input.uni-input-input'))[0]
  const setupPwd2 = (await page.$$('input.uni-input-input'))[1]
  check('找到主密码输入框', !!setupPwd)
  check('找到确认密码输入框', !!setupPwd2)
  if (setupPwd && setupPwd2) {
    await setupPwd.type('MyMaster2026Abc!')
    await setupPwd2.type('MyMaster2026Abc!')
    await sleep(500)
    const vals = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value))
    console.log('  输入后 input.value:', JSON.stringify(vals))
    check('主密码真实输入了 16 位', vals[0] === 'MyMaster2026Abc!', '实际=' + vals[0])
    // 勾选风险确认（点 agree 行）
    await page.evaluate(() => {
      const t = document.querySelector('.agree')
      if (t) t.click()
    })
    await sleep(300)
    // 强度文本
    const setupText = await page.evaluate(() => document.body.innerText)
    console.log('  设置页文本:', setupText.replace(/\s+/g, ' ').slice(0, 300))
    check('强度不再是「很弱」', !setupText.includes('很弱'), '含很弱? ' + setupText.includes('很弱'))

    // 点击完成设置
    await page.evaluate(() => {
      const b = document.querySelector('.primary-btn')
      if (b) b.click()
    })
    await sleep(1800)
    console.log('  完成后 URL:', page.url())
    console.log('  完成后文本:', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300))
  }

  console.log('\n===== 3. 进入密码库，点击新增 =====')
  const vaultText = await page.evaluate(() => document.body.innerText)
  check('进入密码库页', vaultText.includes('我的密码'), vaultText.replace(/\s+/g, ' ').slice(0, 120))
  await page.evaluate(() => {
    const b = document.querySelector('.add-btn')
    if (b) b.click()
  })
  await sleep(1500)
  console.log('  新增页 URL:', page.url())
  const detailText = await page.evaluate(() => document.body.innerText)
  console.log('  新增页文本:', detailText.replace(/\s+/g, ' ').slice(0, 300))

  console.log('\n===== 4. 关键：逐字段输入并验证（用户报告的失效点）=====')
  console.log('  详情页 input 结构:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('input,textarea')].map(i => ({ tag: i.tagName, type: i.type, ph: i.placeholder, cls: i.className })))))
  // detail.vue DOM 顺序: [0]网站名 [1]账号 [2]密码(pwd-input) [3]网址 [4]备注(textarea)
  const allInputs = await page.$$('input.uni-input-input, textarea.uni-input-input, textarea')
  const fieldCases = [
    { name: '网站名称', idx: 0, value: 'github.com' },
    { name: '账号', idx: 1, value: 'dev@example.com' },
    { name: '网址', idx: 3, value: 'https://github.com' },
    { name: '备注', idx: 4, value: '工作账号' }
  ]
  for (const c of fieldCases) {
    const el = allInputs[c.idx]
    if (!el) { check(c.name + ' 输入框存在', false, '索引 ' + c.idx + ' 无元素'); continue }
    await el.evaluate(node => node.focus())
    await page.keyboard.type(c.value)
    await sleep(200)
  }
  const allVals = await page.evaluate(() => [...document.querySelectorAll('input,textarea')].map(i => i.value))
  console.log('  逐字段输入后所有值:', JSON.stringify(allVals))
  for (const c of fieldCases) {
    check(c.name + ' 可输入且值正确', allVals[c.idx] === c.value, '期望=' + c.value + ' 实际=' + allVals[c.idx])
  }
  // 密码字段（自定义组件）
  const pwdField = allInputs[2]
  if (pwdField) {
    await pwdField.evaluate(node => node.focus())
    await page.keyboard.type('Str0ng!Pass#123')
    await sleep(300)
    const pv = await page.evaluate(() => {
      const list = [...document.querySelectorAll('input,textarea')]
      return list[2] ? list[2].value : null
    })
    check('密码字段可输入', pv === 'Str0ng!Pass#123', '实际=' + pv)
  } else {
    check('密码字段输入框存在', false)
  }

  // 保存前打印所有 input 值
  console.log('  保存前所有输入值:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('input,textarea')].map(i => i.value))))

  console.log('\n===== 5. 保存并验证 =====')
  await page.evaluate(() => {
    const b = document.querySelector('.primary-btn')
    if (b) b.click()
  })
  await sleep(1500)
  console.log('  保存后 URL:', page.url())
  const afterSave = await page.evaluate(() => document.body.innerText)
  console.log('  保存后文本:', afterSave.replace(/\s+/g, ' ').slice(0, 400))
  check('列表出现 github.com', afterSave.includes('github.com'), '')
  // 读取落盘数据确认字段真的存进去了
  const stored = await page.evaluate(() => localStorage.getItem('pv.vault'))
  check('落盘密文存在', !!stored && stored.indexOf('PV1.') >= 0, '')

  console.log('\n===== 页面异常汇总 =====')
  if (pageErrors.length) pageErrors.forEach(e => console.log('  ' + e))
  else console.log('  无 JS 异常')

} catch (e) {
  console.log('E2E 异常:', e && e.stack ? e.stack : e)
  check('E2E 流程无异常', false, String(e))
} finally {
  const pass = results.filter(r => r.ok).length
  console.log('\n===== 汇总 =====')
  console.log('通过 ' + pass + ' / ' + results.length)
  results.filter(r => !r.ok).forEach(r => console.log('  FAIL  ' + r.name + '  ' + (r.detail || '')))
  await browser.close()
  process.exit(pass === results.length ? 0 : 1)
}
