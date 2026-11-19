/**
 * 加密核心适配层。
 *
 * 方案（架构文档 §1.3）：
 *   masterKey = PBKDF2-HMAC-SHA256(masterPassword, salt16B, 120000, 32B)
 *   encKey/macKey = HKDF-Expand(HMAC-SHA256) 域分离派生
 *   记录密文 = E1.<ivB64>.<ctB64>.<macB64>，AES-256-CBC(Pkcs7) + HMAC-SHA256，Encrypt-then-MAC
 *   校验块 = PV1.<saltB64>.<ivB64>.<ctB64>.<macB64>
 *
 * 明文纪律：本文件不打印任何密码/密钥/明文；异常只携带统一错误码。
 */
import { KDF, PREFIX, CHECK_CHALLENGE, ERROR_CODES, createError } from './constants.js'
import csprng from './csprng.js'
import logger from './logger.js'

/**
 * CryptoJS 引入（标准 npm 包，Vite 自动转换为 ESM 默认导出，H5 / App 三端一致）。
 *
 * 设计取舍：相比本地 UMD 单文件 require/hack，npm 包方式在 Vue3 + Vite 下
 * 构建可靠、无需条件编译兜底；crypto-js 为纯 JS 约 20KB，不违反「零重型依赖」原则。
 */
import CryptoJS from 'crypto-js'

/** PBKDF2 使用的 HMAC 哈希器 */
const PBKDF2_HASHER = CryptoJS.algo.SHA256

/**
 * Uint8Array -> CryptoJS WordArray（手工按大端序填充，兼容所有 CryptoJS 构建）。
 * @param {Uint8Array} bytes 输入字节
 * @returns {Object} WordArray
 */
function u8ToWa(bytes) {
  const words = []
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= (bytes[i] & 0xff) << (24 - (i % 4) * 8)
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

/**
 * CryptoJS WordArray -> Uint8Array。
 * @param {Object} wa WordArray
 * @returns {Uint8Array}
 */
function waToU8(wa) {
  const out = new Uint8Array(wa.sigBytes)
  for (let i = 0; i < wa.sigBytes; i++) {
    out[i] = (wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
  }
  return out
}

/**
 * HKDF-Expand 单块派生（输出 32 字节，正好一个 HMAC-SHA256 块）。
 * @param {Object} prkWa 伪随机密钥 WordArray
 * @param {string} info 域分离标签
 * @returns {Object} WordArray
 */
function hkdfExpand(prkWa, info) {
  const infoWa = CryptoJS.enc.Utf8.parse(info).concat(CryptoJS.enc.Hex.parse('01'))
  return CryptoJS.HmacSHA256(infoWa, prkWa)
}

/**
 * 计算 Encrypt-then-MAC 标签：HMAC-SHA256(macKey, iv || ct)。
 * @param {Object} ivWa IV WordArray
 * @param {Object} ctWa 密文 WordArray
 * @param {Object} macKeyWa MAC 子密钥 WordArray
 * @returns {string} base64 标签
 */
function computeMacB64(ivWa, ctWa, macKeyWa) {
  return CryptoJS.HmacSHA256(ivWa.concat(ctWa), macKeyWa).toString(CryptoJS.enc.Base64)
}

/**
 * 恒定时间比较两段 base64 标签，避免时序侧信道。
 * @param {string} aB64 标签 A
 * @param {string} bB64 标签 B
 * @returns {boolean}
 */
function constantTimeEqualB64(aB64, bB64) {
  let a = new Uint8Array(0)
  let b = new Uint8Array(0)
  try {
    a = waToU8(CryptoJS.enc.Base64.parse(aB64))
    b = waToU8(CryptoJS.enc.Base64.parse(bB64))
  } catch (e) {
    return false
  }
  let diff = a.length ^ b.length
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    const left = i < a.length ? a[i] : 0
    const right = i < b.length ? b[i] : 0
    diff |= left ^ right
  }
  return diff === 0
}

/**
 * 校验迭代次数是否落在允许范围，异常时回退安全默认值。
 * @param {*} iter 原始迭代次数
 * @returns {number}
 */
function safeIterations(iter) {
  const value = Number(iter)
  if (!Number.isInteger(value) || value < KDF.MIN_ITERATIONS || value > KDF.MAX_ITERATIONS) {
    return KDF.ITERATIONS
  }
  return value
}

const cryptoAdapter = {
  /**
   * 由主密码与盐派生主密钥（PBKDF2-HMAC-SHA256）。
   * @param {string} masterPassword 主密码
   * @param {string} saltB64 16 字节盐的 base64
   * @param {number} iterations 迭代次数
   * @returns {Uint8Array} 32 字节 masterKey
   */
  deriveMasterKey: function deriveMasterKey(masterPassword, saltB64, iterations) {
    if (typeof masterPassword !== 'string' || masterPassword.length === 0 || typeof saltB64 !== 'string' || !saltB64) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '密钥派生参数不完整')
    }
    const masterKeyWa = CryptoJS.PBKDF2(masterPassword, CryptoJS.enc.Base64.parse(saltB64), {
      keySize: KDF.KEY_SIZE_WORDS,
      iterations: safeIterations(iterations),
      hasher: PBKDF2_HASHER
    })
    return waToU8(masterKeyWa)
  },

  /**
   * 域分离派生 encKey / macKey（HKDF-like）。
   * @param {Uint8Array} masterKey 32 字节主密钥
   * @returns {{encKey: Uint8Array, macKey: Uint8Array}}
   */
  deriveSubKeys: function deriveSubKeys(masterKey) {
    if (!masterKey || masterKey.length !== KDF.KEY_BYTES) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '主密钥长度非法')
    }
    const prkWa = u8ToWa(masterKey)
    const encKey = hkdfExpand(prkWa, 'personal-password-vault/enc/v1')
    const macKey = hkdfExpand(prkWa, 'personal-password-vault/mac/v1')
    return { encKey: waToU8(encKey), macKey: waToU8(macKey) }
  },

  /**
   * 解析校验块，返回各段（不解密任何敏感内容）。
   * @param {string} checkBlock PV1... 校验块
   * @returns {{saltB64: string, ivB64: string, ctB64: string, macB64: string, iter: number}}
   */
  parseCheckBlock: function parseCheckBlock(checkBlock) {
    const parts = String(checkBlock || '').split('.')
    if (parts.length !== 5 || parts[0] !== PREFIX.CHECK) {
      throw createError(ERROR_CODES.CRYPTO_FORMAT, '校验块格式错误')
    }
    if (!parts[1] || !parts[2] || !parts[3] || !parts[4]) {
      throw createError(ERROR_CODES.CRYPTO_FORMAT, '校验块字段缺失')
    }
    return { saltB64: parts[1], ivB64: parts[2], ctB64: parts[3], macB64: parts[4], iter: KDF.ITERATIONS }
  },

  /**
   * 首次设置主密码时生成校验块。
   * @param {string} masterPassword 主密码
   * @param {number} [iterations] 迭代次数，默认为配置值
   * @returns {string} PV1.<salt>.<iv>.<ct>.<mac>
   */
  createCheckBlock: function createCheckBlock(masterPassword, iterations) {
    if (typeof masterPassword !== 'string' || masterPassword.length === 0) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '主密码为空')
    }
    const iter = safeIterations(iterations === undefined ? KDF.ITERATIONS : iterations)
    const saltB64 = csprng.randomB64(KDF.SALT_BYTES)
    const ivB64 = csprng.randomB64(KDF.IV_BYTES)
    const masterKey = this.deriveMasterKey(masterPassword, saltB64, iter)
    let subKeys = null
    try {
      subKeys = this.deriveSubKeys(masterKey)
      const iv = CryptoJS.enc.Base64.parse(ivB64)
      const cipher = CryptoJS.AES.encrypt(CHECK_CHALLENGE, u8ToWa(subKeys.encKey), {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      })
      const ct = cipher.ciphertext
      const macB64 = computeMacB64(iv, ct, u8ToWa(subKeys.macKey))
      return [PREFIX.CHECK, saltB64, ivB64, ct.toString(CryptoJS.enc.Base64), macB64].join('.')
    } finally {
      this.wipe(masterKey)
      if (subKeys) this.wipeSubKeys(subKeys)
    }
  },

  /**
   * 校验主密码：先验 MAC 再解密挑战串；成功返回派生出的 masterKey。
   *
   * 注意：校验块格式本身不含迭代次数，因此提供可选第三参数由 vault.kdf.iter 传入，
   * 省略时使用 constants 中的默认迭代次数（保持架构文档的两参数签名兼容）。
   *
   * @param {string} masterPassword 待验证主密码
   * @param {string} checkBlock PV1 校验块
   * @param {number} [iterations] 迭代次数
   * @returns {Uint8Array} masterKey
   */
  verifyAndDerive: function verifyAndDerive(masterPassword, checkBlock, iterations) {
    const parsed = this.parseCheckBlock(checkBlock)
    const iter = safeIterations(iterations === undefined ? KDF.ITERATIONS : iterations)
    const masterKey = this.deriveMasterKey(masterPassword, parsed.saltB64, iter)
    let subKeys = null
    try {
      subKeys = this.deriveSubKeys(masterKey)
      const iv = CryptoJS.enc.Base64.parse(parsed.ivB64)
      const ct = CryptoJS.enc.Base64.parse(parsed.ctB64)
      const expectedMac = computeMacB64(iv, ct, u8ToWa(subKeys.macKey))
      if (!constantTimeEqualB64(expectedMac, parsed.macB64)) {
        throw createError(ERROR_CODES.CRYPTO_AUTH, '主密码错误或数据被篡改')
      }
      let plain = ''
      try {
        plain = CryptoJS.AES.decrypt({ ciphertext: ct }, u8ToWa(subKeys.encKey), {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8)
      } catch (e) {
        throw createError(ERROR_CODES.CRYPTO_AUTH, '校验块解密失败')
      }
      if (plain !== CHECK_CHALLENGE) {
        throw createError(ERROR_CODES.CRYPTO_AUTH, '主密码错误')
      }
      return masterKey
    } catch (e) {
      this.wipe(masterKey)
      logger.error(ERROR_CODES.CRYPTO_AUTH, 'AUTH')
      throw e
    } finally {
      if (subKeys) this.wipeSubKeys(subKeys)
    }
  },

  /**
   * 记录级加密：明文 JSON 字符串 -> E1.<iv>.<ct>.<mac>。
   * @param {string} plainJson 明文 JSON 字符串
   * @param {{encKey: Uint8Array, macKey: Uint8Array}} subKeys 子密钥
   * @returns {string}
   */
  encryptRecord: function encryptRecord(plainJson, subKeys) {
    if (!subKeys || !subKeys.encKey || !subKeys.macKey) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '子密钥缺失')
    }
    const ivB64 = csprng.randomB64(KDF.IV_BYTES)
    const iv = CryptoJS.enc.Base64.parse(ivB64)
    const encKeyWa = u8ToWa(subKeys.encKey)
    const cipher = CryptoJS.AES.encrypt(String(plainJson), encKeyWa, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    })
    const ct = cipher.ciphertext
    const macB64 = computeMacB64(iv, ct, u8ToWa(subKeys.macKey))
    return [PREFIX.RECORD, ivB64, ct.toString(CryptoJS.enc.Base64), macB64].join('.')
  },

  /**
   * 记录级解密：E1.<iv>.<ct>.<mac> -> 明文 JSON 字符串。
   * 先验 MAC，失败抛 E_CRYPTO_AUTH；前缀错误抛 E_CRYPTO_FORMAT。
   * @param {string} encStr 记录密文
   * @param {{encKey: Uint8Array, macKey: Uint8Array}} subKeys 子密钥
   * @returns {string}
   */
  decryptRecord: function decryptRecord(encStr, subKeys) {
    const parts = String(encStr || '').split('.')
    if (parts.length !== 4 || parts[0] !== PREFIX.RECORD) {
      throw createError(ERROR_CODES.CRYPTO_FORMAT, '记录密文格式错误')
    }
    if (!subKeys || !subKeys.encKey || !subKeys.macKey) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '子密钥缺失')
    }
    let iv = null
    let ct = null
    try {
      iv = CryptoJS.enc.Base64.parse(parts[1])
      ct = CryptoJS.enc.Base64.parse(parts[2])
    } catch (e) {
      throw createError(ERROR_CODES.CRYPTO_FORMAT, '密文编码错误')
    }
    const expectedMac = computeMacB64(iv, ct, u8ToWa(subKeys.macKey))
    if (!constantTimeEqualB64(expectedMac, parts[3])) {
      throw createError(ERROR_CODES.CRYPTO_AUTH, '完整性校验失败')
    }
    try {
      return CryptoJS.AES.decrypt({ ciphertext: ct }, u8ToWa(subKeys.encKey), {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }).toString(CryptoJS.enc.Utf8)
    } catch (e) {
      throw createError(ERROR_CODES.CRYPTO_AUTH, '记录解密失败')
    }
  },

  /**
   * 通用加密（导入导出/同步封装用）。AES key 直接传入，MAC 子密钥由 key 域分离派生。
   * @param {Uint8Array|string} data 待加密数据
   * @param {Uint8Array} key 32 字节密钥
   * @returns {{ivB64: string, ctB64: string, macB64: string}}
   */
  encryptBytes: function encryptBytes(data, key) {
    if (!key || key.length !== KDF.KEY_BYTES) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '密钥长度非法')
    }
    const keyWa = u8ToWa(key)
    const macKeyWa = hkdfExpand(keyWa, 'personal-password-vault/bytes-mac/v1')
    const dataWa = typeof data === 'string' ? CryptoJS.enc.Utf8.parse(data) : u8ToWa(data)
    const ivB64 = csprng.randomB64(KDF.IV_BYTES)
    const iv = CryptoJS.enc.Base64.parse(ivB64)
    const ct = CryptoJS.AES.encrypt(dataWa, keyWa, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).ciphertext
    return {
      ivB64: ivB64,
      ctB64: ct.toString(CryptoJS.enc.Base64),
      macB64: computeMacB64(iv, ct, macKeyWa)
    }
  },

  /**
   * 通用解密（encryptBytes 的逆运算）。
   * @param {{ivB64: string, ctB64: string, macB64: string}} bundle 密文包
   * @param {Uint8Array} key 32 字节密钥
   * @returns {Uint8Array} 明文原始字节
   */
  decryptBytes: function decryptBytes(bundle, key) {
    if (!bundle || !bundle.ivB64 || !bundle.ctB64 || !bundle.macB64) {
      throw createError(ERROR_CODES.CRYPTO_FORMAT, '密文包格式错误')
    }
    if (!key || key.length !== KDF.KEY_BYTES) {
      throw createError(ERROR_CODES.CRYPTO_PARAMS, '密钥长度非法')
    }
    const keyWa = u8ToWa(key)
    const macKeyWa = hkdfExpand(keyWa, 'personal-password-vault/bytes-mac/v1')
    const iv = CryptoJS.enc.Base64.parse(bundle.ivB64)
    const ct = CryptoJS.enc.Base64.parse(bundle.ctB64)
    if (!constantTimeEqualB64(computeMacB64(iv, ct, macKeyWa), bundle.macB64)) {
      throw createError(ERROR_CODES.CRYPTO_AUTH, '完整性校验失败')
    }
    try {
      const plain = CryptoJS.AES.decrypt({ ciphertext: ct }, keyWa, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      })
      return waToU8(plain)
    } catch (e) {
      throw createError(ERROR_CODES.CRYPTO_AUTH, '解密失败')
    }
  },

  /**
   * 内存清理：覆盖字节数组引用内容。
   * JS 无法强制 GC，约定「覆盖 + 解除引用 + 不落盘」为可接受的清理策略。
   * @param {Uint8Array|Object} key 待清理的密钥
   */
  wipe: function wipe(key) {
    if (!key) return
    try {
      if (typeof key.fill === 'function') {
        key.fill(0)
      } else if (key.words && typeof key.sigBytes === 'number') {
        for (let i = 0; i < key.words.length; i++) key.words[i] = 0
        key.sigBytes = 0
      }
    } catch (e) {
      // 清理失败必须静默，不能影响锁定主流程
    }
  },

  /**
   * 清理子密钥对。
   * @param {{encKey: Uint8Array, macKey: Uint8Array}} subKeys 子密钥
   */
  wipeSubKeys: function wipeSubKeys(subKeys) {
    if (!subKeys) return
    this.wipe(subKeys.encKey)
    this.wipe(subKeys.macKey)
    subKeys.encKey = null
    subKeys.macKey = null
  }
}

export default cryptoAdapter
