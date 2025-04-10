// src/core/memory-monitor.js
/**
 * 内存监控器 - 监控和管理Node.js应用的内存使用
 */
class MemoryMonitor {
  /**
   * @param {object} options 配置选项
   * @param {number} options.warningThreshold 警告阈值(MB)
   * @param {number} options.criticalThreshold 临界阈值(MB)
   * @param {Function} options.onWarning 警告回调
   * @param {Function} options.onCritical 临界回调
   */
  constructor(options = {}) {
    this.warningThreshold = (options.warningThreshold || 1024) * 1024 * 1024; // 默认1GB
    this.criticalThreshold = (options.criticalThreshold || 1.5 * 1024) * 1024 * 1024; // 默认1.5GB
    this.onWarning = options.onWarning || (usage => console.warn(`内存使用警告: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`));
    this.onCritical = options.onCritical || (usage => console.error(`内存使用临界: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`));
    this.interval = null;
    this.lastUsage = null;
  }

  /**
   * 开始监控
   * @param {number} checkInterval 检查间隔(ms)
   */
  start(checkInterval = 5000) {
    if (this.interval) {
      this.stop();
    }
    
    this.interval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      this.lastUsage = memoryUsage;
      
      if (memoryUsage.heapUsed > this.criticalThreshold) {
        this.onCritical(memoryUsage);
        // 可选：强制垃圾回收（需要使用--expose-gc启动Node）
        if (global.gc) {
          global.gc();
        }
      } else if (memoryUsage.heapUsed > this.warningThreshold) {
        this.onWarning(memoryUsage);
      }
    }, checkInterval);
    
    console.log(`内存监控已启动，警告阈值: ${Math.round(this.warningThreshold / 1024 / 1024)}MB，临界阈值: ${Math.round(this.criticalThreshold / 1024 / 1024)}MB`);
    return this;
  }

  /**
   * 停止监控
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('内存监控已停止');
    }
    return this;
  }

  /**
   * 获取当前内存使用情况
   * @returns {object} 内存使用情况
   */
  getMemoryUsage() {
    const usage = this.lastUsage || process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      rssMB: Math.round(usage.rss / 1024 / 1024)
    };
  }

  /**
   * 检查当前内存使用是否超过警告阈值
   * @returns {boolean} 是否超过警告阈值
   */
  isWarningThresholdExceeded() {
    const usage = process.memoryUsage();
    return usage.heapUsed > this.warningThreshold;
  }

  /**
   * 检查当前内存使用是否超过临界阈值
   * @returns {boolean} 是否超过临界阈值
   */
  isCriticalThresholdExceeded() {
    const usage = process.memoryUsage();
    return usage.heapUsed > this.criticalThreshold;
  }

  /**
   * 尝试释放内存
   * @returns {object} 释放前后的内存使用情况
   */
  tryFreeMemory() {
    const beforeUsage = process.memoryUsage();
    
    // 尝试强制垃圾回收
    if (global.gc) {
      global.gc();
    }
    
    const afterUsage = process.memoryUsage();
    const freedMemory = beforeUsage.heapUsed - afterUsage.heapUsed;
    
    return {
      before: {
        heapUsed: beforeUsage.heapUsed,
        heapUsedMB: Math.round(beforeUsage.heapUsed / 1024 / 1024)
      },
      after: {
        heapUsed: afterUsage.heapUsed,
        heapUsedMB: Math.round(afterUsage.heapUsed / 1024 / 1024)
      },
      freed: freedMemory,
      freedMB: Math.round(freedMemory / 1024 / 1024)
    };
  }
}

module.exports = MemoryMonitor;
