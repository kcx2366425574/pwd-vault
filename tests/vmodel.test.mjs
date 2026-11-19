// 回归验证：pwd-input 的 Vue3 v-model 双向绑定（核心）、业务闭环与使用点影响面。
// 说明：本文件全部路径基于测试文件位置解析，不依赖硬编码绝对路径，可随时复跑。
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import vm from 'vm'
import { webcrypto } from 'crypto'
import { transformSync } from 'esbuild'
import { createRenderer, h, ref, nextTick } from 'vue'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_ROOT = join(PROJECT_ROOT, 'src')
const readSrc = (rel) => readFileSync(join(SRC_ROOT, rel), 'utf8')
const readProject = (rel) => readFileSync(join(PROJECT_ROOT, rel), 'utf8')

const pass = [], fail = []
function ok(name, cond, detail) {
  ;(cond ? pass : fail).push(name)
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail !== undefined ? '  -> ' + detail : ''))
}

// ---- 从 .vue 文件抽取 <script> 并用 esbuild 转成可加载模块 ----
function loadVueScript(relPath, requireMap) {
  const source = readSrc(relPath)
  const matched = source.match(/<script>([\s\S]*?)<\/script>/)
  if (!matched) throw new Error(relPath + ' 未找到 <script> 块')
  const code = transformSync(matched[1], { loader: 'js', format: 'cjs', target: 'es2020' }).code
  const mod = { exports: {} }
  const req = (spec) => {
    if (requireMap && Object.prototype.hasOwnProperty.call(requireMap, spec)) return requireMap[spec]
    return {}
  }
  new Function('module', 'exports', 'require', code)(mod, mod.exports, req)
  return { options: mod.exports.default, template: (source.match(/<template>([\s\S]*?)<\/template>/) || [])[1] || '' }
}

// ---- Node 模拟 H5 环境（与 runtime.test.mjs 同构），用于服务层业务闭环 ----
const memory = {}
const localStorage = {
  getItem: k => (k in memory ? memory[k] : null),
  setItem: (k, v) => { memory[k] = String(v) },
  removeItem: k => { delete memory[k] },
  clear: () => { for (const k of Object.keys(memory)) delete memory[k] }
}
const sandbox = {
  console,
  Uint8Array, Uint32Array, Array, Object, JSON, Math, Date, Number, String, Promise, Error,
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage,
  crypto: { getRandomValues: arr => webcrypto.getRandomValues(arr) }
}
sandbox.window = sandbox
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(readSrc('common/lib/crypto-js.min.js'), sandbox)
sandbox.CryptoJS = sandbox.CryptoJS || sandbox.cryptoJS
sandbox.uni = {
  getStorageSync: k => localStorage.getItem(k),
  setStorageSync: (k, v) => localStorage.setItem(k, v),
  removeStorageSync: k => localStorage.removeItem(k),
  showToast: () => {},
  setNavigationBarTitle: () => {}
}
const cache = {}
function loadModule(relPath) {
  const abs = join(SRC_ROOT, relPath).replace(/\\/g, '/')
  if (cache[abs]) return cache[abs].exports
  const result = transformSync(readFileSync(abs, 'utf8'), { loader: 'js', format: 'cjs', target: 'es2020' })
  const mod = { exports: {} }
  cache[abs] = mod
  const req = (spec) => {
    if (spec === 'crypto-js') return sandbox.CryptoJS
    if (spec.startsWith('.')) {
      const base = relPath.split('/').slice(0, -1)
      const parts = spec.replace(/^\.\//, '').split('/')
      const combined = [...base]
      for (const p of parts) { if (p === '..') combined.pop(); else if (p !== '.') combined.push(p) }
      const resolved = combined.join('/') + (combined[combined.length - 1].includes('.js') ? '' : '.js')
      return loadModule(resolved)
    }
    return {}
  }
  const fn = vm.runInContext('(function(module, exports, require, __dirname){' + result.code + '\n})', sandbox)
  fn(mod, mod.exports, req, '')
  return mod.exports
}

const PWD15 = 'MyMaster!2026ab' // 15 位强密码：大小写 + 数字 + 符号
const PWD_EMIT = 'MyMaster!2026abc'

console.log('\n===== A. v-model 双向绑定（Vue 真实运行时） =====')
try {
  const { options: PwdInput, template } = loadVueScript('components/pwd-input.vue')

  ok('A1 props 声明包含 modelValue(String/默认空串)',
    !!PwdInput.props.modelValue && PwdInput.props.modelValue.type === String && PwdInput.props.modelValue.default === '',
    JSON.stringify(PwdInput.props.modelValue))
  ok('A1 保留 value prop（向后兼容）', !!PwdInput.props.value, JSON.stringify(PwdInput.props.value))

  // A2：把模板里的 :value 表达式取出来真实求值，确认 modelValue 优先、null/undefined 回退 value
  const valueExpr = (template.match(/:value="([^"]+)"/) || [])[1]
  ok('A2 模板 :value 绑定存在', !!valueExpr, valueExpr)
  const resolveValue = (ctx) => vm.runInNewContext('(' + valueExpr + ')', ctx)
  ok('A2 :value 优先取 modelValue', resolveValue({ modelValue: '来自modelValue', value: '来自value' }) === '来自modelValue')
  ok('A2 modelValue=undefined 回退 value', resolveValue({ modelValue: undefined, value: '来自value' }) === '来自value')
  ok('A2 modelValue=null 回退 value', resolveValue({ modelValue: null, value: '来自value' }) === '来自value')

  // A3：用 Vue3 createRenderer 挂载真实组件，模拟编译器产出的 v-model 绑定，
  //     再调用组件真实的 onInput，验证 emit 与父状态回流。
  const nodeOps = {
    createElement: tag => ({ tag, children: [], props: {} }),
    createText: text => ({ text: String(text) }),
    createComment: text => ({ text: String(text), comment: true }),
    setText: (node, text) => { node.text = String(text) },
    setElementText: (el, text) => { el.textContent = String(text) },
    parentNode: node => node.parent || null,
    nextSibling: node => node.next || null,
    querySelector: () => null,
    setScopeId: () => {},
    insert: (child, parent) => { child.parent = parent; parent.children.push(child) },
    remove: child => { if (child.parent) { const i = child.parent.children.indexOf(child); if (i >= 0) child.parent.children.splice(i, 1) } },
    patchProp: (el, key, prev, next) => { el.props[key] = next }
  }
  const { createApp } = createRenderer(nodeOps)
  const parentCalls = []
  const childInstances = []
  let parentState = null
  // 运行时构建不编译 SFC 模板，补一个等价 render 仅用于承载 props；methods/data 仍来自真实组件选项。
  const Child = Object.assign({}, PwdInput, { render() { return h('input') } })
  const Parent = {
    setup() {
      parentState = ref('')
      return { password: parentState }
    },
    render() {
      return h(Child, {
        ref: inst => { if (inst) childInstances.push(inst) },
        modelValue: this.password,
        'onUpdate:modelValue': v => { parentCalls.push(['update:modelValue', v]); this.password = v },
        onInput: v => { parentCalls.push(['input', v]) }
      })
    }
  }
  const app = createApp(Parent)
  app.mount(nodeOps.createElement('div'))
  const inst = childInstances[0]
  inst.onInput({ detail: { value: PWD_EMIT } })
  await nextTick()

  ok('A3 emit update:modelValue 携带正确输入值',
    parentCalls.some(c => c[0] === 'update:modelValue' && c[1] === PWD_EMIT),
    JSON.stringify(parentCalls))
  ok('A3 同时 emit input（兼容旧监听）',
    parentCalls.some(c => c[0] === 'input' && c[1] === PWD_EMIT))
  ok('A3 父组件 password 由空串变为输入值', parentState.value === PWD_EMIT, JSON.stringify(parentState.value))
  ok('A3 回流后子组件 modelValue prop 同步为输入值',
    childInstances[childInstances.length - 1].modelValue === PWD_EMIT)

  // A4：连续输入不同值（含空串与符号）均应正确回传，避免只测一次巧合通过
  const seq = ['', 'A', 'Aa1!aaaaaaaaaaa']
  for (const v of seq) {
    childInstances[childInstances.length - 1].onInput({ detail: { value: v } })
    await nextTick()
  }
  ok('A4 连续输入最终值与父状态一致', parentState.value === seq[seq.length - 1], JSON.stringify(parentState.value))
  ok('A4 空串输入也能清空父状态', parentCalls.some(c => c[0] === 'update:modelValue' && c[1] === ''))
  app.unmount()
} catch (e) {
  ok('A 组执行异常', false, e && e.stack ? e.stack : e)
}

console.log('\n===== B. 端到端业务闭环（15 位强密码） =====')
try {
  const authService = loadModule('services/auth-service.js').default
  const validator = loadModule('utils/validator.js').default
  const generatorService = loadModule('services/generator-service.js').default
  const healthService = loadModule('services/health-service.js').default
  const { options: StrengthMeter } = loadVueScript('components/strength-meter.vue', {
    '../services/generator-service.js': { __esModule: true, default: generatorService }
  })

  ok('B1 测试密码确为 15 位', PWD15.length === 15, PWD15.length)

  const analysis = validator.analyzePassword(PWD15)
  const validation = validator.validateMasterPassword(PWD15)
  ok('B2 analyzePassword 判定为强/极强', analysis.label === '强' || analysis.label === '极强', analysis.label)
  ok('B2 validateMasterPassword 通过', validation.valid === true, JSON.stringify(validation.errors))
  ok('B2 不再返回「主密码至少需要 8 位」', validation.errors.indexOf('主密码至少需要 8 位') === -1)
  ok('B2 空串仍会被拦截（校验逻辑未被架空）',
    validator.validateMasterPassword('').errors.indexOf('主密码至少需要 8 位') !== -1)

  // strength-meter 的真实 computed：score=generatorService.strength，level=ceil(score/20)
  // computed 之间存在链式依赖（label 依赖 level，level 依赖 score），需按 Vue 的求值顺序注入
  const meterCtx = { password: PWD15 }
  const score = StrengthMeter.computed.score.call(meterCtx)
  meterCtx.score = score
  const level = StrengthMeter.computed.level.call(meterCtx)
  meterCtx.level = level
  const label = StrengthMeter.computed.label.call(meterCtx)
  ok('B3 强度条分数非零', score > 0, score)
  ok('B3 强度条等级为高（非很弱）', level >= 3, 'level=' + level)
  ok('B3 强度条文案为较强/强/很强', ['较强', '强', '很强'].indexOf(label) !== -1, label)
  ok('B3 强度条不再显示「很弱」', label !== '很弱')

  const setupResult = authService.setupMasterPassword(PWD15)
  ok('B4 setupMasterPassword 成功不抛错', setupResult === true)
  ok('B4 密码库已创建且已解锁', authService.hasVault() === true && authService.isUnlocked() === true)
  ok('B4 落盘不含主密码明文', memory['pv.vault'].indexOf('MyMaster') === -1)

  const report = healthService.audit(180)
  ok('B5 healthService.audit 正常返回报告', !!report && Array.isArray(report.weak), Object.keys(report || {}).join(','))

  authService.lock()
  ok('B6 锁定后未解锁', authService.isUnlocked() === false)
  const unlockResult = authService.unlock(PWD15)
  ok('B6 同一密码解锁成功', unlockResult === true && authService.isUnlocked() === true)
} catch (e) {
  ok('B 组执行异常', false, e && e.stack ? e.stack : e)
}

console.log('\n===== C. 影响面回归（6 处使用点 + 原生 input） =====')
try {
  const usage = [
    ['src/pages/setup/setup.vue', 'pwd'],
    ['src/pages/setup/setup.vue', 'pwd2'],
    ['src/pages/detail/detail.vue', 'form.password'],
    ['src/pages/import-export/import-export.vue', 'exportPwd'],
    ['src/pages/import-export/import-export.vue', 'importPwd'],
    ['src/pages/index/index.vue', 'password']
  ]
  let found = 0
  for (const [rel, target] of usage) {
    const text = readSrc(rel.replace(/^src\//, ''))
    const tags = text.match(/<pwd-input\b[^>]*>/g) || []
    const targetTag = tags.filter(t => t.indexOf('v-model="' + target + '"') !== -1)
    found += targetTag.length
    ok('C1 ' + rel + ' 的 v-model="' + target + '" 存在', targetTag.length === 1)
    ok('C1 ' + rel + ' 的该使用点无 @input 冲突', targetTag.length === 1 && !/@input\s*=/.test(targetTag[0]))
  }
  ok('C1 共核对 6 处 pwd-input 使用点', found === 6, found)

  const indexText = readSrc('pages/index/index.vue')
  ok('C2 index.vue 无残留 @input="onPwd"', !/@input\s*=\s*"onPwd"/.test(indexText))
  ok('C2 index.vue 无残留 onPwd 方法', !/onPwd\s*:/.test(indexText))

  const vaultText = readSrc('pages/vault/vault.vue')
  ok('C3 vault.vue 搜索仍从 e.detail.value 读取', /onSearch:\s*function\s*\(e\)\s*\{\s*this\.keyword\s*=\s*e\.detail\.value/.test(vaultText))
  const filterText = readSrc('components/filter-bar.vue')
  ok('C3 filter-bar.vue 搜索框保留 v-model="keyword"', /<input[^>]*v-model="keyword"[^>]*@input="onChange"/.test(filterText))
  ok('C3 filter-bar.vue onChange 不依赖 e.detail.value（由 v-model 回写）',
    /onChange:\s*function\s*\(\)\s*\{\s*this\.emitChange\(\)/.test(filterText))
} catch (e) {
  ok('C 组执行异常', false, e && e.stack ? e.stack : e)
}

console.log('\n===== 汇总 =====')
console.log('通过 ' + pass.length + ' / ' + (pass.length + fail.length))
if (fail.length) {
  console.log('失败项:')
  fail.forEach(n => console.log('  - ' + n))
  process.exit(1)
}
console.log('ALL PASS')
