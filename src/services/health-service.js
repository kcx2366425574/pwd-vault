/**
 * 密码安全体检服务：包装 security-audit 纯函数，读取内存条目并给出报告。
 */
import securityAudit from '../utils/security-audit.js'
import entryService from './entry-service.js'

const healthService = {
  /**
   * 生成体检报告。
   * @param {number} [staleDays] 陈旧阈值天数，默认 180
   */
  audit: function audit(staleDays) {
    return securityAudit.audit(entryService.listAll(), staleDays)
  }
}

export default healthService
