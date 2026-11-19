/**
 * 同步提供者接口约定（文档化接口，供具体实现参考）。
 *
 * interface SyncProvider {
 *   isConfigured(): boolean
 *   login(account: string, credential: string): Promise<{userId:string, token:string}>
 *   logout(): void
 *   upload(vaultCipher: string, meta: Object): Promise<{ok:boolean, syncedAt:number}>
 *   download(since: number): Promise<Array<{vaultCipher:string, meta:Object}>>
 *   getStatus(): {online:boolean, lastSyncAt:number}
 * }
 *
 * 端到端加密约定：upload/download 处理的都是「记录级密文」，
 * 服务端与传输层永远拿不到明文与密钥（E2EE）。
 */
export default {}
