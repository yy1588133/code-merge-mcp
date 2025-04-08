// src/tools/get_file_tree.js
const path = require('path');
const fs = require('fs').promises;
const { listFiles } = require('../core/file-lister');
// --- Tree Rendering Logic (adapted from frontend logic) ---
/**
 * Builds a hierarchical tree object from a flat list of file paths.
 * @param {string[]} filePaths Array of relative file paths.
 * @returns {object} A nested object representing the directory structure.
 */
function buildTreeObject(filePaths) {
    const tree = {};
    // Sort paths alphabetically for consistent tree structure
    const sortedPaths = [...filePaths].sort((a, b) => a.localeCompare(b));
    sortedPaths.forEach(filePath => {
        // Normalize path separators just in case
        const parts = filePath.replace(/\\/g, '/').split('/');
        let currentLevel = tree;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue; // Skip empty parts potentially caused by leading/trailing slashes
            if (i === parts.length - 1) { // It's a file
                if (!currentLevel._files) {
                    currentLevel._files = [];
                }
                // Avoid adding duplicates if path normalization leads to same entry
                if (!currentLevel._files.includes(part)) {
                     currentLevel._files.push(part);
                }
            } else { // It's a directory
                if (!currentLevel[part]) {
                    currentLevel[part] = {}; // Create directory node if it doesn't exist
                }
                // Ensure we don't try to traverse into a file node mistakenly marked earlier
                if (typeof currentLevel[part] === 'object' && currentLevel[part] !== null) {
                    currentLevel = currentLevel[part];
                } else {
                    // Handle potential path conflict (e.g., 'a/b' file and 'a/b/c' directory)
                    // This basic builder assumes valid, non-conflicting paths from listFiles
                    console.warn(`Path conflict or unexpected structure processing: ${filePath}`);
                    break; // Stop processing this conflicting path
                }
            }
        }
    });
    return tree;
}
/**
 * Renders the tree object into a string format.
 * @param {object} node The current node in the tree object.
 * @param {string} [prefix=''] The prefix string for the current level.
 * @returns {string} The string representation of the tree branch.
 */
function renderTree(node, prefix = '') {
    let result = '';
    // Get directory names, sort them
    const folders = Object.keys(node).filter(key => key !== '_files').sort((a, b) => a.localeCompare(b));
    // Get file names, sort them
    const files = node._files ? [...node._files].sort((a, b) => a.localeCompare(b)) : [];
    const totalItems = folders.length + files.length;
    let itemCount = 0;
    // Render folders first
    folders.forEach((folder) => {
        itemCount++;
        const isLast = itemCount === totalItems;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   '; // Connector for children
        result += prefix + connector + folder + '/\n';
        result += renderTree(node[folder], prefix + childPrefix); // Recurse into subdirectory
    });
    // Render files
    files.forEach((file) => {
         itemCount++;
        const isLast = itemCount === totalItems;
        const connector = isLast ? '└── ' : '├── ';
        result += prefix + connector + file + '\n';
    });
    return result;
}
// --- Tool Handler ---
/**
 * Handles the 'get_file_tree' MCP request.
 * @param {object} parameters Request parameters.
 * @param {string} parameters.path The target directory path.
 * @param {boolean} [parameters.use_gitignore=true]
 * @param {boolean} [parameters.ignore_git=true]
 * @param {string[]} [parameters.custom_blacklist=[]]
 * @returns {Promise<object>} The result object containing the file tree string.
 */
async function handleRequest(parameters) {
    console.error('get_file_tree: Starting execution');
    const startTime = Date.now();

    const { path: targetPath, use_gitignore, ignore_git, custom_blacklist } = parameters;
    if (!targetPath) {
        throw new Error("Missing required parameter: 'path'.");
    }

    // Resolve to absolute path - assuming the input path might be relative to CWD
    const absolutePath = path.resolve(targetPath);
    console.error(`get_file_tree: Resolved path to ${absolutePath}`);

    // Validate path existence and type
    try {
        const stats = await fs.stat(absolutePath);
        if (!stats.isDirectory()) {
            throw new Error(`Path '${targetPath}' is not a directory.`);
        }
        console.error(`get_file_tree: Validated path exists and is a directory`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Path '${targetPath}' not found.`);
        }
        // Rethrow other stat errors (like permission issues)
        throw new Error(`Error accessing path '${targetPath}': ${error.message}`);
    }

    // List files using the core lister and provided filter options
    console.error(`get_file_tree: Listing files in ${absolutePath}`);
    const fileList = await listFiles(absolutePath, {
        useGitignore: use_gitignore || false, // Pass through params correctly, default to false for speed
        ignoreGit: ignore_git || true,
        customBlacklist: custom_blacklist || []
    });
    console.error(`get_file_tree: Found ${fileList.length} files`);

    // Build and render the tree structure
    console.error(`get_file_tree: Building tree object`);
    const treeObject = buildTreeObject(fileList);
    const rootDirName = path.basename(absolutePath);

    // Render the tree starting from the root object, prefix indicates level
    console.error(`get_file_tree: Rendering tree`);
    const treeString = rootDirName + '/\n' + renderTree(treeObject);

    const executionTime = Date.now() - startTime;
    console.error(`get_file_tree: Execution completed in ${executionTime}ms`);

    return {
        file_tree: treeString // Return the result in the expected format
    };
}
module.exports = {
    handleRequest,
    handler: handleRequest // Export as handler for compatibility with stdio-handler.js
};