/**
 * 加密导入导出服务（.pwdvault 备份格式）。
 *
 * 导出：用主密码派生独立密钥，把整库密文再次封装为带 KDF 参数的备份文件。
 * 导入：解析备份 → 用用户输入密码派生密钥 → 解密校验 → 整库替换。
 */
import {
  ERROR_CODES, PREFIX, KDF, VAULT_VERSION, createError
} from '../utils/constants.js'
import cryptoAdapter from '../utils/crypto.js'
import csprng from '../utils/csprng.js'
import vaultService from './vault-service.js'

const BACKUP_MAGIC = 'PVBACKUP1'

const backupService = {
  /**
   * 导出加密备份 JSON 字符串。
   * @param {string} masterPassword 主密码（用于加密备份）
   * @returns {string} 备份文件文本
   */
  exportEncrypted: function exportEncrypted(masterPassword) {
    if (!String(masterPassword || '')) throw createError(ERROR_CODES.VALIDATION, '请输入主密码')
    const vaultCipher = vaultService.getVaultCipher()
    if (!vaultCipher) throw createError(ERROR_CODES.CRYPTO_PARAMS, '密码库为空')
    const saltB64 = csprng.randomB64(KDF.SALT_BYTES)
    const key = cryptoAdapter.deriveMasterKey(masterPassword, saltB64, KDF.ITERATIONS)
    try {
      const bundle = cryptoAdapter.encryptBytes(vaultCipher, key)
      return JSON.stringify({
        magic: BACKUP_MAGIC,
        v: VAULT_VERSION,
        kdf: { alg: KDF.ALGORITHM, iter: KDF.ITERATIONS, salt: saltB64 },
        iv: bundle.ivB64,
        ct: bundle.ctB64,
        mac: bundle.macB64,
        exportedAt: Date.now()
      })
    } finally {
      cryptoAdapter.wipe(key)
    }
  },

  /**
   * 从备份文本恢复（解密校验后整库替换）。
   * @param {string} text 备份文本
   * @param {string} masterPassword 备份密码
   * @returns {boolean}
   */
  importEncrypted: function importEncrypted(text, masterPassword) {
    let obj
    try { obj = JSON.parse(String(text || '')) } catch (e) {
      throw createError(ERROR_CODES.BACKUP_FORMAT, '备份文件格式错误')
    }
    if (!obj || obj.magic !== BACKUP_MAGIC || !obj.kdf || !obj.ct) {
      throw createError(ERROR_CODES.BACKUP_FORMAT, '不是有效的密码保险箱备份')
    }
    const iter = Number(obj.kdf.iter) || KDF.ITERATIONS
    const key = cryptoAdapter.deriveMasterKey(masterPassword, obj.kdf.salt, iter)
    try {
      const plainBytes = cryptoAdapter.decryptBytes(
        { ivB64: obj.iv, ctB64: obj.ct, macB64: obj.mac }, key
      )
      let vaultCipher = ''
      for (let i = 0; i < plainBytes.length; i++) vaultCipher += String.fromCharCode(plainBytes[i])
      const dto = JSON.parse(vaultCipher)
      if (!dto || !dto.check || !Array.isArray(dto.entries)) {
        throw createError(ERROR_CODES.BACKUP_FORMAT, '备份内容损坏')
      }
      vaultService.applyDTO(dto)
      vaultService.persist()
      return true
    } finally {
      cryptoAdapter.wipe(key)
    }
  }
}

export default backupService
