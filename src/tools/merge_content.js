// src/tools/merge_content.js
const path = require('path');
const fs = require('fs').promises;
const { listFiles } = require('../core/file-lister');
const { readFiles, getFileCache } = require('../core/file-reader');
const { compressContent } = require('../core/compressor');
const MemoryMonitor = require('../core/memory-monitor');
const { BINARY_EXTENSIONS } = require('../core/filter');

// 创建内存监控器
const memoryMonitor = new MemoryMonitor({
    warningThreshold: 512,  // 512MB警告
    criticalThreshold: 768, // 768MB临界
    onWarning: (usage) => {
        console.error(`merge_content: 内存使用警告 ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
    },
    onCritical: (usage) => {
        console.error(`merge_content: 内存使用临界 ${Math.round(usage.heapUsed / 1024 / 1024)}MB，尝试释放内存`);
        // 尝试释放内存
        getFileCache().invalidate();
        if (global.gc) {
            global.gc();
        }
    }
});

// 注意：我们使用readFiles函数内部的批处理器，不需要在这里显式使用
/**
 * Handles the 'merge_content' MCP request.
 * @param {object} parameters Request parameters.
 * @param {string} parameters.path The target file or directory path.
 * @param {boolean} [parameters.compress=false] Whether to compress the output.
 * @param {boolean} [parameters.use_gitignore=true]
 * @param {boolean} [parameters.ignore_git=true]
 * @param {string[]} [parameters.custom_blacklist=[]]
 * @returns {Promise<object>} The result object containing the merged content string.
 */
async function handleRequest(parameters) {
    console.error('merge_content: Starting execution');
    const startTime = Date.now();

    // 启动内存监控
    memoryMonitor.start(10000); // 每10秒检查一次

    const {
        path: targetPath,
        compress = false,
        use_gitignore,
        ignore_git,
        custom_blacklist,
        use_cache = true,
        use_streams = true,
        max_files = 1000 // 限制处理文件数量
    } = parameters;

    if (!targetPath) {
        memoryMonitor.stop();
        throw new Error("Missing required parameter: 'path'.");
    }

    // Resolve to absolute path
    const absolutePath = path.resolve(targetPath);
    console.error(`merge_content: Resolved path to ${absolutePath}`);

    let rootPath = absolutePath; // Assume path is directory initially
    let filesToProcess = [];

    // Validate path existence and determine if it's a file or directory
    try {
        const stats = await fs.stat(absolutePath);
        console.error(`merge_content: Path exists, checking type`);

        if (stats.isDirectory()) {
            // Path is a directory, list files within it
            console.error(`merge_content: Path is a directory, listing files`);
            rootPath = absolutePath; // Keep rootPath as the directory itself

            // For performance, default to false for gitignore to speed up processing
            filesToProcess = await listFiles(absolutePath, {
                useGitignore: use_gitignore || false,
                ignoreGit: ignore_git || true,
                customBlacklist: custom_blacklist || []
            });

            // 限制文件数量以防止内存耗尽
            if (filesToProcess.length > max_files) {
                console.error(`merge_content: Limiting files from ${filesToProcess.length} to ${max_files}`);
                filesToProcess = filesToProcess.slice(0, max_files);
            }

            console.error(`merge_content: Found ${filesToProcess.length} files in directory`);

        } else if (stats.isFile()) {
            // Path is a single file
            console.error(`merge_content: Path is a file`);
            rootPath = path.dirname(absolutePath); // Set rootPath to the parent directory
            const relativeFilePath = path.basename(absolutePath);

            // Skip gitignore checks for single files to improve performance
            filesToProcess.push(relativeFilePath);
            console.error(`merge_content: Added single file to process: ${relativeFilePath}`);

            // Check if it's a binary file
            const fileExtension = path.extname(relativeFilePath).toLowerCase();
            if (BINARY_EXTENSIONS.has(fileExtension)) {
                filesToProcess = []; // Clear if binary
                console.error(`merge_content: Skipping binary file: ${relativeFilePath}`);
            }
        } else {
            // Path exists but is not a file or directory (e.g., socket, fifo)
            memoryMonitor.stop();
            throw new Error(`Path '${targetPath}' is not a file or directory.`);
        }
    } catch (error) {
        memoryMonitor.stop();
        if (error.code === 'ENOENT') {
            throw new Error(`Path '${targetPath}' not found.`);
        }
        throw new Error(`Error accessing path '${targetPath}': ${error.message}`);
    }

    if (filesToProcess.length === 0) {
        // If no files are left after filtering (or it was an ignored/binary single file)
        console.error(`merge_content: No files to process, returning empty content`);
        memoryMonitor.stop();
        return { merged_content: "" }; // Return empty content
    }

    // Read the content of the filtered files
    console.error(`merge_content: Reading content of ${filesToProcess.length} files`);

    // 使用优化的文件读取函数，支持缓存和流式处理
    const fileContentsMap = await readFiles(filesToProcess, rootPath, {
        useCache: use_cache,
        useStreams: use_streams,
        progressCallback: (progress) => {
            if (progress.percent % 10 === 0) { // 每完成10%输出一次进度
                console.error(`merge_content: Reading progress ${progress.percent}% (${progress.completed}/${progress.total})`);
            }
        }
    });

    // Combine contents with headers, ensuring consistent order
    console.error(`merge_content: Combining file contents`);
    let combinedContent = "";

    // Sort file paths before merging for deterministic output
    const sortedRelativePaths = [...fileContentsMap.keys()].sort((a, b) => a.localeCompare(b));
    let filesProcessed = 0;

    sortedRelativePaths.forEach(relativeFilePath => {
        const content = fileContentsMap.get(relativeFilePath);
        if (content !== undefined) { // Check if file read was successful
            // Add a header to distinguish file contents
            const safeFilePath = relativeFilePath.replace(/\\/g, '/');
            combinedContent += `=== File Path: ${safeFilePath} ===\n\n`;

            // Process content to ensure it's safe for JSON serialization
            // We don't need to apply makeJsonSafe here as we're just building the combined content
            // The final result will be handled by the MCP server's adaptToolResult function
            combinedContent += content;
            combinedContent += '\n\n' + '='.repeat(50) + '\n\n';
            filesProcessed++;
        }
    });

    console.error(`merge_content: Successfully processed ${filesProcessed} files`);

    // Apply compression if requested
    let finalContent = combinedContent.trim(); // Trim final whitespace
    if (compress) {
        console.error(`merge_content: Compressing content`);
        finalContent = compressContent(finalContent);
    }

    // 获取内存使用情况
    const memoryUsage = memoryMonitor.getMemoryUsage();
    const executionTime = Date.now() - startTime;

    // 停止内存监控
    memoryMonitor.stop();

    console.error(`merge_content: Execution completed in ${executionTime}ms, memory used: ${memoryUsage.heapUsedMB}MB`);

    // 返回结果并包含性能指标
    return {
        merged_content: finalContent,
        performance: {
            executionTime,
            filesProcessed,
            totalFiles: filesToProcess.length,
            memoryUsedMB: memoryUsage.heapUsedMB,
            cacheStats: use_cache ? getFileCache().getStats() : null
        }
    };
}
module.exports = {
    handleRequest,
    handler: handleRequest // Export as handler for compatibility with stdio-handler.js
};