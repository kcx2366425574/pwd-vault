/**
 * 轻量多语言模块：内置中英文词条，按设置切换。未命中 key 时回退中文。
 * 非敏感，不涉及加密。
 */
import { LANGUAGES } from './constants.js'

const DICT = {
  'zh-CN': {
    appName: '密码保险箱',
    unlock: '解锁',
    masterPassword: '主密码',
    confirmPassword: '确认主密码',
    unlockHint: '请输入主密码以解锁',
    setupTitle: '设置主密码',
    setupWarning: '忘记主密码将无法找回，加密数据不可恢复',
    vault: '密码库',
    addEntry: '新增条目',
    search: '搜索网站或账号',
    site: '网站名称',
    account: '账号',
    password: '密码',
    url: '网址',
    note: '备注',
    save: '保存',
    cancel: '取消',
    delete: '删除',
    generate: '生成密码',
    copy: '复制',
    copied: '已复制，%ss 后自动清空',
    settings: '设置',
    changeMaster: '修改主密码',
    autoLock: '自动锁定',
    biometric: '生物识别解锁',
    secureScreen: '防截屏',
    theme: '主题',
    language: '语言',
    sync: '云同步',
    syncNow: '立即同步',
    health: '安全体检',
    importExport: '导入与导出',
    export: '导出备份',
    import: '导入备份',
    reminders: '更新提醒',
    noData: '暂无数据',
    locked: '已锁定',
    wrongPassword: '主密码错误或数据被篡改',
    backoff: '尝试过于频繁，请 %ss 后再试'
  },
  'en-US': {
    appName: 'Password Vault',
    unlock: 'Unlock',
    masterPassword: 'Master password',
    confirmPassword: 'Confirm master password',
    unlockHint: 'Enter master password to unlock',
    setupTitle: 'Set master password',
    setupWarning: 'Master password cannot be recovered. Encrypted data will be lost.',
    vault: 'Vault',
    addEntry: 'Add entry',
    search: 'Search site or account',
    site: 'Site',
    account: 'Account',
    password: 'Password',
    url: 'URL',
    note: 'Note',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    generate: 'Generate',
    copy: 'Copy',
    copied: 'Copied, clears in %ss',
    settings: 'Settings',
    changeMaster: 'Change master password',
    autoLock: 'Auto lock',
    biometric: 'Biometric unlock',
    secureScreen: 'Block screenshots',
    theme: 'Theme',
    language: 'Language',
    sync: 'Cloud sync',
    syncNow: 'Sync now',
    health: 'Security check',
    importExport: 'Import & Export',
    export: 'Export backup',
    import: 'Import backup',
    reminders: 'Renewal reminders',
    noData: 'No data',
    locked: 'Locked',
    wrongPassword: 'Wrong master password or tampered data',
    backoff: 'Too many attempts, retry in %ss'
  }
}

let currentLang = LANGUAGES.ZH_CN

const i18n = {
  setLanguage: function setLanguage(lang) {
    currentLang = DICT[lang] ? lang : LANGUAGES.ZH_CN
  },
  getLanguage: function getLanguage() { return currentLang },
  /**
   * 取文案，支持 %s 占位替换。
   * @param {string} key
   * @param {...*} args
   */
  t: function t(key) {
    const table = DICT[currentLang] || DICT['zh-CN']
    let text = table[key] !== undefined ? table[key] : (DICT['zh-CN'][key] !== undefined ? DICT['zh-CN'][key] : key)
    for (let i = 1; i < arguments.length; i++) {
      text = String(text).replace('%s', String(arguments[i]))
    }
    return text
  }
}

export default i18n
