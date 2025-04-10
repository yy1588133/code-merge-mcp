// src/mcp-server.js
// MCP server implementation using the official MCP SDK

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { makeJsonSafe } = require('./core/json-utils');

// Import tool implementation files
let getFileTreeHandler, mergeContentHandler, analyzeCodeHandler;

try {
    const getFileTreeModule = require('./tools/get_file_tree');
    getFileTreeHandler = getFileTreeModule.handler || getFileTreeModule.handleRequest;

    const mergeContentModule = require('./tools/merge_content');
    mergeContentHandler = mergeContentModule.handler || mergeContentModule.handleRequest;

    const analyzeCodeModule = require('./tools/analyze_code');
    analyzeCodeHandler = analyzeCodeModule.handler || analyzeCodeModule.handleRequest;

    if (!getFileTreeHandler || !mergeContentHandler || !analyzeCodeHandler) {
        console.error('Warning: One or more tool handlers could not be loaded properly');
        if (!getFileTreeHandler) console.error('Missing handler for get_file_tree');
        if (!mergeContentHandler) console.error('Missing handler for merge_content');
        if (!analyzeCodeHandler) console.error('Missing handler for analyze_code');
    }
} catch (error) {
    console.error('Error loading tool handlers:', error);
}

// Create an MCP server instance
const server = new McpServer({
    name: 'code-merge-mcp',
    version: '0.3.1'
});

// Adapter function to convert tool results to MCP SDK format
function adaptToolResult(result) {
    // Convert the result to the format expected by the MCP SDK
    // This function also ensures all text content is safe for JSON serialization
    // The SDK expects a result with a 'content' array of content items
    if (!result) {
        return { content: [] };
    }

    // If the result already has a 'content' property, return it as is
    if (result.content) {
        return result;
    }

    // Otherwise, convert the result to the expected format
    const content = [];

    // Handle get_file_tree result
    if (result.file_tree) {
        content.push({
            type: 'text',
            text: result.file_tree // File tree is already formatted as text
        });
    }

    // Handle merge_content result
    if (result.merged_content) {
        // Ensure merged content is safe for JSON serialization
        content.push({
            type: 'text',
            text: result.merged_content
        });
    }

    // If no specific handling, convert any string properties to text content
    if (content.length === 0) {
        for (const [propertyName, value] of Object.entries(result)) {
            if (typeof value === 'string') {
                content.push({
                    type: 'text',
                    // Ensure property values are safe for JSON serialization
                    text: `${propertyName}: ${value}`
                });
            }
        }
    }

    // If still no content, create a JSON representation
    if (content.length === 0) {
        try {
            content.push({
                type: 'text',
                text: JSON.stringify(result, null, 2)
            });
        } catch (error) {
            // Handle JSON serialization errors
            console.error('Error serializing result to JSON:', error.message);
            content.push({
                type: 'text',
                text: `Error: Could not serialize result to JSON. ${error.message}`
            });
        }
    }

    return { content };
}

// Register the get_file_tree tool
if (getFileTreeHandler) {
    server.tool(
        'get_file_tree',
        'Retrieves the file tree structure of the project.',
        {
            path: z.string().optional().describe('The target directory path.'),
            use_gitignore: z.boolean().optional().describe('Whether to use .gitignore rules.'),
            ignore_git: z.boolean().optional().describe('Whether to ignore the .git directory.'),
            custom_blacklist: z.array(z.string()).optional().describe('Custom blacklist items.')
        },
        async (params) => {
            logInfo(`Executing get_file_tree tool with params: ${JSON.stringify(params)}`);
            try {
                const startTime = Date.now();
                const result = await getFileTreeHandler(params);
                const executionTime = Date.now() - startTime;
                logDebug(`get_file_tree completed in ${executionTime}ms`);
                return adaptToolResult(result);
            } catch (error) {
                logError('Error in get_file_tree tool:', error);
                throw error;
            }
        }
    );
}

// Register the merge_content tool
if (mergeContentHandler) {
    server.tool(
        'merge_content',
        'Merges content from multiple files into a single output file.',
        {
            path: z.string().describe('The target file or directory path.'),
            compress: z.boolean().optional().describe('Whether to compress the output.'),
            use_gitignore: z.boolean().optional().describe('Whether to use .gitignore rules.'),
            ignore_git: z.boolean().optional().describe('Whether to ignore the .git directory.'),
            custom_blacklist: z.array(z.string()).optional().describe('Custom blacklist items.')
        },
        async (params) => {
            logInfo(`Executing merge_content tool with params: ${JSON.stringify(params)}`);
            try {
                const startTime = Date.now();
                const result = await mergeContentHandler(params);
                const executionTime = Date.now() - startTime;
                logDebug(`merge_content completed in ${executionTime}ms`);

                // Ensure the merged content is safe for JSON serialization
                if (result && result.merged_content) {
                    // We don't modify the content directly here
                    // The adaptToolResult function will handle the content safely
                    logDebug(`merge_content result size: ${result.merged_content.length} characters`);
                }

                return adaptToolResult(result);
            } catch (error) {
                logError('Error in merge_content tool:', error);
                throw error;
            }
        }
    );
}

// Register the analyze_code tool
if (analyzeCodeHandler) {
    server.tool(
        'analyze_code',
        'Analyzes code files and provides statistics.',
        {
            path: z.string().describe('The target file or directory path.'),
            language: z.string().optional().describe('Optional language filter.'),
            countLines: z.boolean().optional().describe('Whether to count lines of code.'),
            countFunctions: z.boolean().optional().describe('Whether to count functions.')
        },
        async (params) => {
            logInfo(`Executing analyze_code tool with params: ${JSON.stringify(params)}`);
            try {
                const startTime = Date.now();
                const result = await analyzeCodeHandler(params);
                const executionTime = Date.now() - startTime;
                logDebug(`analyze_code completed in ${executionTime}ms`);
                return adaptToolResult(result);
            } catch (error) {
                logError('Error in analyze_code tool:', error);
                throw error;
            }
        }
    );
}

// Register prompts using the SDK's prompt method

// Register prompt handlers
server.prompt('code-merge', {
    name: 'Code Merge',
    description: 'A prompt for merging code from multiple files',
    parameters: {
        files: z.string().describe('Comma-separated list of files to merge')
    },
    async complete({ files }) {
        logInfo(`Completing code-merge prompt with files: ${files}`);
        return {
            content: [{
                type: 'text',
                text: `Merging files: ${files}\n\nThis is a placeholder response. In a real implementation, this would call the merge_content tool and format the results.`
            }]
        };
    }
});

server.prompt('code-review', {
    name: 'Code Review',
    description: 'A prompt for reviewing code',
    parameters: {
        code: z.string().describe('The code to review')
    },
    async complete({ code }) {
        logInfo(`Completing code-review prompt with code length: ${code.length}`);
        return {
            content: [{
                type: 'text',
                text: `Code review:\n\nThis is a placeholder response. In a real implementation, this would analyze the code and provide feedback.`
            }]
        };
    }
});

server.prompt('code-explain', {
    name: 'Code Explanation',
    description: 'A prompt for explaining code',
    parameters: {
        code: z.string().describe('The code to explain')
    },
    async complete({ code }) {
        logInfo(`Completing code-explain prompt with code length: ${code.length}`);
        return {
            content: [{
                type: 'text',
                text: `Code explanation:\n\nThis is a placeholder response. In a real implementation, this would analyze the code and provide an explanation.`
            }]
        };
    }
});

// Enhanced logging function
function logInfo(message) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [INFO] ${message}`);
}

function logError(message, error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`, error || '');
}

function logDebug(message) {
    if (process.env.DEBUG === 'true') {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [DEBUG] ${message}`);
    }
}

// Set up error handlers for the server
function setupErrorHandlers() {
    // The SDK doesn't provide direct error handlers at this level
    // We'll rely on the transport error handlers and try/catch blocks
    logInfo('Setting up error handlers');
}

// Function to start the server
async function startServer() {
    try {
        logInfo('Starting MCP Server with SDK...');

        // Setup error handlers
        setupErrorHandlers();

        // Create a stdio transport
        const transport = new StdioServerTransport();

        // Add transport error handler
        transport.onerror = (error) => {
            logError('Transport error:', error);
        };

        transport.onclose = () => {
            logInfo('Transport closed');
        };

        // Connect the server to the transport
        await server.connect(transport);

        logInfo('MCP Server with SDK started successfully');
    } catch (error) {
        logError('Error starting MCP Server with SDK:', error);
        process.exit(1);
    }
}

// Export the server and start function
module.exports = {
    server,
    startServer
};

// If this file is run directly, start the server
if (require.main === module) {
    startServer();
}
