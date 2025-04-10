// src/core/file-reader.js
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const { Readable } = require('stream');
const FileCache = require('./file-cache');
const BatchProcessor = require('./batch-processor');

// 创建文件缓存实例
const fileCache = new FileCache({
    maxSize: 500,  // 最多缓存500个文件
    ttl: 10 * 60 * 1000  // 10分钟缓存时间
});

// 创建批处理器实例
const batchProcessor = new BatchProcessor(8); // 并行处理8个文件

/**
 * 流式读取文件内容
 * @param {string} filePath 文件路径
 * @param {object} options 选项
 * @returns {Promise<string>} 文件内容
 */
async function readFileStream(filePath, options = {}) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const readStream = fs.createReadStream(filePath, {
            encoding: 'utf8',
            highWaterMark: options.chunkSize || 64 * 1024 // 64KB chunks
        });

        readStream.on('data', (chunk) => chunks.push(chunk));
        readStream.on('end', () => resolve(chunks.join('')));
        readStream.on('error', reject);
    });
}

/**
 * 智能选择读取方法
 * 对小文件使用一次性读取，对大文件使用流式读取
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} 文件内容
 */
async function smartReadFile(filePath) {
    try {
        const stats = await fsPromises.stat(filePath);
        // 文件小于1MB时使用一次性读取
        if (stats.size < 1024 * 1024) {
            return await fsPromises.readFile(filePath, 'utf8');
        } else {
            // 大文件使用流式读取
            return await readFileStream(filePath);
        }
    } catch (error) {
        throw new Error(`读取文件 ${filePath} 失败: ${error.message}`);
    }
}

/**
 * 读取文件内容，优先使用缓存
 * @param {string} filePath 文件路径
 * @returns {Promise<string>} 文件内容
 */
async function readFileWithCache(filePath) {
    try {
        return await fileCache.get(filePath);
    } catch (error) {
        // 如果缓存读取失败，回退到直接读取
        const content = await smartReadFile(filePath);
        // 尝试将内容添加到缓存
        try {
            const stats = await fsPromises.stat(filePath);
            fileCache.set(fileCache.generateKey(filePath), {
                content,
                timestamp: Date.now(),
                mtime: stats.mtimeMs,
                size: content.length
            });
        } catch (e) {
            // 忽略缓存错误
        }
        return content;
    }
}

/**
 * 读取多个文件的内容，使用批处理和缓存优化
 * @param {string[]} relativeFilePaths 相对文件路径数组
 * @param {string} rootPath 项目根路径
 * @param {object} options 选项
 * @param {boolean} options.useCache 是否使用缓存
 * @param {boolean} options.useStreams 是否使用流式处理
 * @param {Function} options.progressCallback 进度回调函数
 * @returns {Promise<Map<string, string>>} 文件内容映射
 */
async function readFiles(relativeFilePaths, rootPath, options = {}) {
    const {
        useCache = true,
        useStreams = true,
        progressCallback = null
    } = options;

    if (!relativeFilePaths || relativeFilePaths.length === 0) {
        return new Map();
    }

    const fileContents = new Map();
    const startTime = Date.now();

    // 使用批处理器并行处理文件
    const results = await batchProcessor.processBatch(
        relativeFilePaths,
        async (relativeFilePath) => {
            const absolutePath = path.join(rootPath, relativeFilePath);
            try {
                let content;

                if (useCache) {
                    // 使用缓存读取
                    content = await readFileWithCache(absolutePath);
                } else if (useStreams) {
                    // 使用智能读取（根据文件大小选择方法）
                    content = await smartReadFile(absolutePath);
                } else {
                    // 使用传统方法
                    content = await fsPromises.readFile(absolutePath, 'utf8');
                }

                fileContents.set(relativeFilePath, content);
                return { success: true, path: relativeFilePath };
            } catch (error) {
                console.error(`Error reading file ${absolutePath}:`, error.message);
                return { success: false, path: relativeFilePath, error: error.message };
            }
        },
        progressCallback
    );

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    console.error(`readFiles: Processed ${relativeFilePaths.length} files in ${duration}ms, success: ${successCount}, failed: ${relativeFilePaths.length - successCount}`);

    if (useCache) {
        const cacheStats = fileCache.getStats();
        console.error(`readFiles: Cache stats - hits: ${cacheStats.hits}, misses: ${cacheStats.misses}, hit rate: ${Math.round(cacheStats.hitRate * 100)}%, size: ${cacheStats.size} items, ${cacheStats.bytesStoredMB}MB`);
    }

    return fileContents;
}

/**
 * 获取文件缓存实例
 * @returns {FileCache} 文件缓存实例
 */
function getFileCache() {
    return fileCache;
}

/**
 * 获取批处理器实例
 * @returns {BatchProcessor} 批处理器实例
 */
function getBatchProcessor() {
    return batchProcessor;
}

module.exports = {
    readFiles,
    readFileWithCache,
    smartReadFile,
    readFileStream,
    getFileCache,
    getBatchProcessor
};