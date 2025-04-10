// src/core/batch-processor.js
/**
 * 批处理器 - 控制并行任务数量，避免资源过度使用
 */
class BatchProcessor {
  /**
   * @param {number} concurrency 并行任务数
   */
  constructor(concurrency = 4) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * 添加任务到队列
   * @param {Function} task 任务函数，返回Promise
   * @returns {Promise} 任务结果
   */
  add(task) {
    this.stats.totalTasks++;
    
    return new Promise((resolve, reject) => {
      this.queue.push({ 
        task, 
        resolve, 
        reject,
        addedTime: Date.now()
      });
      
      this.processQueue();
    });
  }

  /**
   * 处理队列中的任务
   * @private
   */
  processQueue() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    // 如果这是第一个任务，记录开始时间
    if (this.stats.startTime === null && this.stats.completedTasks === 0) {
      this.stats.startTime = Date.now();
    }

    const { task, resolve, reject, addedTime } = this.queue.shift();
    this.running++;

    const waitTime = Date.now() - addedTime;
    const startTime = Date.now();

    Promise.resolve(task())
      .then(result => {
        this.stats.completedTasks++;
        resolve(result);
      })
      .catch(error => {
        this.stats.failedTasks++;
        reject(error);
      })
      .finally(() => {
        const executionTime = Date.now() - startTime;
        this.running--;
        
        // 如果队列为空且没有运行中的任务，记录结束时间
        if (this.queue.length === 0 && this.running === 0) {
          this.stats.endTime = Date.now();
        }
        
        this.processQueue();
      });
  }

  /**
   * 批量处理任务
   * @param {Array} items 要处理的项目
   * @param {Function} taskFn 处理单个项目的函数
   * @param {Function} [progressCallback] 进度回调函数
   * @returns {Promise<Array>} 处理结果数组
   */
  async processBatch(items, taskFn, progressCallback = null) {
    if (!items || items.length === 0) {
      return [];
    }
    
    const total = items.length;
    const results = new Array(total);
    let completed = 0;
    
    // 重置统计信息
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      startTime: null,
      endTime: null
    };
    
    const promises = items.map((item, index) => {
      return this.add(async () => {
        try {
          const result = await taskFn(item, index);
          
          // 更新进度
          completed++;
          if (progressCallback) {
            progressCallback({
              completed,
              total,
              percent: Math.round((completed / total) * 100),
              item,
              index
            });
          }
          
          results[index] = { success: true, result };
          return result;
        } catch (error) {
          results[index] = { success: false, error };
          throw error;
        }
      }).catch(error => {
        // 捕获错误但不中断整个批处理
        return { success: false, error };
      });
    });
    
    await Promise.all(promises);
    
    return results;
  }

  /**
   * 获取处理统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    const now = Date.now();
    const duration = this.stats.endTime 
      ? (this.stats.endTime - this.stats.startTime) 
      : (this.stats.startTime ? (now - this.stats.startTime) : 0);
    
    return {
      ...this.stats,
      duration,
      durationSeconds: Math.round(duration / 1000),
      tasksPerSecond: duration > 0 ? Math.round((this.stats.completedTasks / duration) * 1000) : 0,
      successRate: this.stats.totalTasks > 0 
        ? (this.stats.completedTasks / this.stats.totalTasks) 
        : 0,
      queueLength: this.queue.length,
      runningTasks: this.running
    };
  }

  /**
   * 清空队列
   * @returns {number} 清空的任务数量
   */
  clearQueue() {
    const count = this.queue.length;
    
    // 拒绝所有排队中的任务
    this.queue.forEach(({ reject }) => {
      reject(new Error('任务队列已清空'));
    });
    
    this.queue = [];
    return count;
  }
}

module.exports = BatchProcessor;
