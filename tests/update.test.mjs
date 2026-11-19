// 在线升级纯逻辑测试：版本比较、Release 解析、资产挑选、force 判断。
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import vm from 'vm'
import { transformSync } from 'esbuild'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const pass = [], fail = []
function ok(name, cond, detail) {
  (cond ? pass : fail).push(name)
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (detail !== undefined ? '  -> ' + detail : ''))
}

// 用 esbuild 加载 ESM 模块（把 import 替换为 stub）
function load(rel, importMap = {}) {
  let code = readFileSync(join(SRC, rel), 'utf8')
  // 保留 config import（APP_META 需要真实声明），其余 import 移除
  code = code.replace(/^import \{ APP_META \} from ['"][^'"]+['"]\s*$/gm, 'const APP_META = __APP_META__')
  code = code.replace(/^import .*?from ['"][^'"]+['"]\s*$/gm, '')
  const r = transformSync(code, { loader: 'js', format: 'cjs', target: 'es2020' })
  const mod = { exports: {} }
  const req = (spec) => importMap[spec] || {}
  const ctx = { __APP_META__: importMap['__APP_META__'] || { versionName: '1.0.0', versionCode: 100, update: {} }, console, setTimeout }
  vm.runInNewContext('(function(module,exports,require,__APP_META__){' + r.code + '\n})')(mod, mod.exports, req, ctx.__APP_META__)
  return mod.exports
}

const u = load('services/update-service.js', {
  '../config.js': { APP_META: { versionName: '1.0.0', versionCode: 100, update: { provider: 'github', repo: 'kcx2366425574/pwd-vault' } } },
  '../utils/http.js': { getText: async () => ({ status: 200, text: '{}' }) }
})

console.log('\n===== 版本比较 =====')
ok('compareVersions 1.0.1 > 1.0.0', u.compareVersions('1.0.1', '1.0.0') === 1)
ok('compareVersions 1.0.0 == 1.0.0', u.compareVersions('1.0.0', '1.0.0') === 0)
ok('compareVersions 0.9.9 < 1.0.0', u.compareVersions('0.9.9', '1.0.0') === -1)
ok('trimVersion 处理 v 前缀', u.trimVersion('v1.2.3') === '1.2.3')
ok('trimVersion 处理 tag+说明', u.trimVersion('v1.2.3 正式版') === '1.2.3')
ok('parseVersionCodeFromNotes', u.parseVersionCodeFromNotes('修复问题\nversionCode: 105') === 105)

console.log('\n===== Release 资产挑选 =====')
const assets = [
  { name: 'source.tar.gz', browser_download_url: 'x' },
  { name: 'pwd-v1.0.1-101.apk', browser_download_url: 'https://apk/pwd.apk', size: 12345 }
]
const apk = u.pickReleaseAsset(assets, '.apk')
ok('从 assets 挑出 .apk', !!apk && apk.browser_download_url === 'https://apk/pwd.apk')
ok('无匹配返回 null', u.pickReleaseAsset([{ name: 'a.txt' }], '.apk') === null)

console.log('\n===== payload 解析（versionCode 优先）=====')
const r1 = u.normalizeUpdatePayload(
  { tag_name: 'v9.9.9', body: 'versionCode: 101', assets: [{ name: 'pwd-v1.0.1-101.apk', browser_download_url: 'https://x/app.apk' }] },
  { current: { versionName: '1.0.0', versionCode: 100 }, source: 'github' }
)
ok('versionCode 101 > 100 判定有更新', r1.hasUpdate === true)
ok('解析出 apkUrl', r1.latest.apkUrl === 'https://x/app.apk')
ok('解析出 versionCode 101', r1.latest.versionCode === 101)
ok('source 透传', r1.source === 'github')

const r2 = u.normalizeUpdatePayload(
  { versionName: '1.0.0', versionCode: 100, apkUrl: 'https://x/a.apk' },
  { current: { versionName: '1.0.0', versionCode: 100 } }
)
ok('同版本判定无更新', r2.hasUpdate === false)

const r3 = u.normalizeUpdatePayload(
  { versionName: '2.0.0', notes: '[force] 重大更新', apkUrl: 'https://x/a.apk' },
  { current: { versionName: '1.0.0', versionCode: 100 } }
)
ok('无 versionCode 时按语义版本比较', r3.hasUpdate === true)
ok('[force] 标记识别为强制更新', r3.latest.force === true)

const r4 = u.normalizeUpdatePayload(
  { versionName: '1.1.0', minVersionCode: 101, apkUrl: 'https://x/a.apk' },
  { current: { versionName: '1.0.0', versionCode: 100 } }
)
ok('minVersionCode 触发强制更新', r4.hasUpdate === true && r4.latest.force === true)

console.log('\n===== 汇总 =====')
console.log('通过 ' + pass.length + ' / ' + (pass.length + fail.length))
if (fail.length) { fail.forEach(n => console.log('  FAIL  ' + n)); process.exit(1) }
console.log('ALL PASS')
