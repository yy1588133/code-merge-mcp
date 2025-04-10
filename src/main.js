#!/usr/bin/env node
// src/main.js
// This is the main entry point for the MCP server.
// It now uses the official MCP SDK implementation.

// Set up global error handlers first
process.on('uncaughtException', (error) => {
    console.error('CRITICAL: Uncaught exception in MCP Server:', error);
    // Don't exit immediately to allow error to be logged
    setTimeout(() => process.exit(1), 100);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled promise rejection in MCP Server:', reason);
    // Don't exit immediately to allow error to be logged
    setTimeout(() => process.exit(1), 100);
});

// Configure stdout/stderr
process.stdout.on('error', (err) => {
    console.error('Error writing to stdout:', err);
});

process.stderr.on('error', (err) => {
    // Can't log to stderr if stderr has an error, but try anyway
    try {
        console.error('Error writing to stderr:', err);
    } catch (e) {
        // Nothing we can do here
    }
});

// 引入内存监控器
const MemoryMonitor = require('./core/memory-monitor');

// 创建全局内存监控器
const globalMemoryMonitor = new MemoryMonitor({
    warningThreshold: 1024,  // 1GB警告
    criticalThreshold: 1536, // 1.5GB临界
    onWarning: (usage) => {
        console.error(`[MEMORY WARNING] Server memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
    },
    onCritical: (usage) => {
        console.error(`[MEMORY CRITICAL] Server memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB, attempting to free memory`);
        // 尝试强制垃圾回收
        if (global.gc) {
            global.gc();
            console.error(`[MEMORY] Garbage collection completed`);
        }
    }
});

// 启动内存监控
globalMemoryMonitor.start(30000); // 每30秒检查一次

// 在进程退出时停止监控
process.on('exit', () => {
    globalMemoryMonitor.stop();
});

// Start the server
console.error('Starting MCP Server with SDK...');
try {
    // Use the new MCP server implementation with the official SDK
    const { startServer } = require('./mcp-server');
    startServer();
    console.error("MCP Server with SDK loaded successfully.");

    // 输出初始内存使用情况
    const memoryUsage = globalMemoryMonitor.getMemoryUsage();
    console.error(`Initial memory usage: ${memoryUsage.heapUsedMB}MB / ${memoryUsage.heapTotalMB}MB`);
} catch (error) {
    // Log any critical error during startup and exit
    console.error("Failed to start MCP Server:", error);
    globalMemoryMonitor.stop();
    process.exit(1); // Exit with a non-zero code indicates an error
}

// Keep the process running - the SDK manages the lifecycle based on stdin.
// No explicit server.listen() needed as it communicates via stdio.
console.error('MCP Server initialization complete.');