// src/core/file-cache.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * 文件缓存管理器 - 缓存文件内容以减少I/O操作
 */
class FileCache {
  /**
   * @param {object} options 缓存选项
   * @param {number} options.maxSize 最大缓存项数
   * @param {number} options.ttl 缓存生存时间(ms)
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 5 * 60 * 1000; // 默认5分钟
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      bytesStored: 0
    };
  }

  /**
   * 生成缓存键
   * @param {string} filePath 文件路径
   * @returns {string} 缓存键
   */
  generateKey(filePath) {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  /**
   * 获取文件内容，优先从缓存获取
   * @param {string} filePath 文件路径
   * @returns {Promise<string>} 文件内容
   */
  async get(filePath) {
    const key = this.generateKey(filePath);
    
    if (this.cache.has(key)) {
      const cacheEntry = this.cache.get(key);
      
      // 检查缓存是否过期
      if (Date.now() - cacheEntry.timestamp < this.ttl) {
        // 检查文件是否被修改
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtimeMs <= cacheEntry.mtime) {
            this.stats.hits++;
            return cacheEntry.content;
          }
        } catch (error) {
          // 如果无法获取文件状态，使用缓存内容
          this.stats.hits++;
          return cacheEntry.content;
        }
      }
      
      // 缓存过期，删除
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
      this.stats.bytesStored -= cacheEntry.content.length;
    }
    
    // 缓存未命中，读取文件
    this.stats.misses++;
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);
      
      // 缓存新内容
      this.set(key, {
        content,
        timestamp: Date.now(),
        mtime: stats.mtimeMs,
        size: content.length
      });
      
      return content;
    } catch (error) {
      throw new Error(`读取文件 ${filePath} 失败: ${error.message}`);
    }
  }

  /**
   * 设置缓存
   * @param {string} key 缓存键
   * @param {object} value 缓存值
   */
  set(key, value) {
    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      const oldEntry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.bytesStored -= oldEntry.content.length;
    }
    
    this.cache.set(key, value);
    this.stats.size = this.cache.size;
    this.stats.bytesStored += value.content.length;
  }

  /**
   * 清除缓存
   * @param {string} [filePath] 特定文件路径，不提供则清除所有缓存
   */
  invalidate(filePath) {
    if (filePath) {
      const key = this.generateKey(filePath);
      if (this.cache.has(key)) {
        const entry = this.cache.get(key);
        this.stats.bytesStored -= entry.content.length;
        this.cache.delete(key);
        this.stats.size = this.cache.size;
      }
    } else {
      this.cache.clear();
      this.stats.size = 0;
      this.stats.bytesStored = 0;
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      bytesStoredMB: Math.round(this.stats.bytesStored / 1024 / 1024 * 100) / 100
    };
  }
}

module.exports = FileCache;
