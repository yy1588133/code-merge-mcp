// src/core/tree-cache.js
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * 文件树缓存管理器 - 缓存目录结构以减少文件系统操作
 */
class TreeCache {
  /**
   * @param {object} options 缓存选项
   * @param {number} options.maxEntries 最大缓存条目数
   * @param {number} options.ttl 缓存生存时间(ms)
   */
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || 50;
    this.ttl = options.ttl || 60 * 1000; // 默认1分钟
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * 生成缓存键
   * @param {string} dirPath 目录路径
   * @param {object} options 过滤选项
   * @returns {string} 缓存键
   */
  generateKey(dirPath, options) {
    // 将目录路径和选项组合成缓存键
    const optionsStr = JSON.stringify(options || {});
    return crypto.createHash('md5').update(`${dirPath}:${optionsStr}`).digest('hex');
  }

  /**
   * 获取缓存的文件树
   * @param {string} dirPath 目录路径
   * @param {object} options 过滤选项
   * @returns {Array|null} 缓存的文件树或null
   */
  get(dirPath, options) {
    const key = this.generateKey(dirPath, options);
    
    if (this.cache.has(key)) {
      const entry = this.cache.get(key);
      
      // 检查缓存是否过期
      if (Date.now() - entry.timestamp < this.ttl) {
        // 检查目录是否被修改
        try {
          const stats = fs.statSync(dirPath);
          if (stats.mtimeMs <= entry.mtime) {
            this.stats.hits++;
            return entry.data;
          }
        } catch (error) {
          // 如果无法获取目录状态，使用缓存内容
          this.stats.hits++;
          return entry.data;
        }
      }
      
      // 缓存过期，删除
      this.cache.delete(key);
      this.stats.evictions++;
    }
    
    this.stats.misses++;
    return null;
  }

  /**
   * 设置缓存
   * @param {string} dirPath 目录路径
   * @param {object} options 过滤选项
   * @param {Array} data 文件树数据
   */
  set(dirPath, options, data) {
    const key = this.generateKey(dirPath, options);
    
    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
    
    // 获取目录的修改时间
    let mtime = Date.now();
    try {
      const stats = fs.statSync(dirPath);
      mtime = stats.mtimeMs;
    } catch (error) {
      // 忽略错误，使用当前时间
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      mtime
    });
  }

  /**
   * 清除缓存
   * @param {string} [dirPath] 特定目录路径，不提供则清除所有缓存
   * @param {object} [options] 过滤选项，不提供则清除指定目录的所有缓存
   */
  invalidate(dirPath, options) {
    if (dirPath && options) {
      const key = this.generateKey(dirPath, options);
      this.cache.delete(key);
    } else if (dirPath) {
      // 清除指定目录的所有缓存
      for (const [key, entry] of this.cache.entries()) {
        if (key.startsWith(dirPath)) {
          this.cache.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear();
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }
}

module.exports = TreeCache;
