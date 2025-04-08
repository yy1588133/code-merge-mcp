// src/tools/merge_content.js
const path = require('path');
const fs = require('fs').promises;
const { listFiles } = require('../core/file-lister');
const { readFiles } = require('../core/file-reader');
const { compressContent } = require('../core/compressor');
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

    const { path: targetPath, compress = false, use_gitignore, ignore_git, custom_blacklist } = parameters;
    if (!targetPath) {
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
            if (require('../core/filter').BINARY_EXTENSIONS.has(fileExtension)) {
                filesToProcess = []; // Clear if binary
                console.error(`merge_content: Skipping binary file: ${relativeFilePath}`);
            }
        } else {
            // Path exists but is not a file or directory (e.g., socket, fifo)
            throw new Error(`Path '${targetPath}' is not a file or directory.`);
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Path '${targetPath}' not found.`);
        }
        throw new Error(`Error accessing path '${targetPath}': ${error.message}`);
    }

    if (filesToProcess.length === 0) {
        // If no files are left after filtering (or it was an ignored/binary single file)
        console.error(`merge_content: No files to process, returning empty content`);
        return { merged_content: "" }; // Return empty content
    }

    // Read the content of the filtered files
    console.error(`merge_content: Reading content of ${filesToProcess.length} files`);
    const fileContentsMap = await readFiles(filesToProcess, rootPath);

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
            combinedContent += `=== File Path: ${relativeFilePath.replace(/\\/g, '/')} ===\n\n`;
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

    const executionTime = Date.now() - startTime;
    console.error(`merge_content: Execution completed in ${executionTime}ms`);

    return {
        merged_content: finalContent
    };
}
module.exports = {
    handleRequest,
    handler: handleRequest // Export as handler for compatibility with stdio-handler.js
};