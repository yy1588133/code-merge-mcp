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

// Start the server
console.error('Starting MCP Server with SDK...');
try {
    // Use the new MCP server implementation with the official SDK
    const { startServer } = require('./mcp-server');
    startServer();
    console.error("MCP Server with SDK loaded successfully.");
} catch (error) {
    // Log any critical error during startup and exit
    console.error("Failed to start MCP Server:", error);
    process.exit(1); // Exit with a non-zero code indicates an error
}

// Keep the process running - the SDK manages the lifecycle based on stdin.
// No explicit server.listen() needed as it communicates via stdio.
console.error('MCP Server initialization complete.');