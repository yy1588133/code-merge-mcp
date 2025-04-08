// src/core/file-lister.js
const fs = require('fs').promises;
const path = require('path');
const { loadGitignore, shouldIgnore } = require('./filter'); // Import filter functions
/**
 * Recursively lists all files in a directory that are not ignored by the filter rules.
 * @param {string} startPath The absolute path to the directory to start listing from.
 * @param {string} rootPath The absolute path of the project root (for relative path calculation).
 * @param {object} filterOptions Filter options.
 * @param {boolean} [filterOptions.useGitignore=true] Whether to use .gitignore rules.
 * @param {boolean} [filterOptions.ignoreGit=true] Whether to ignore the .git directory.
 * @param {string[]} [filterOptions.customBlacklist=[]] Custom blacklist items.
 * @param {import('ignore').Ignore|null} filterOptions.gitignoreInstance Pre-loaded ignore instance.
 * @returns {Promise<string[]>} A promise that resolves to an array of relative file paths.
 */
async function listFilesRecursive(startPath, rootPath, filterOptions) {
    let filesList = [];
    try {
        const items = await fs.readdir(startPath, { withFileTypes: true });
        for (const item of items) {
            const currentItemPath = path.join(startPath, item.name);
            const relativePath = path.relative(rootPath, currentItemPath);
            // First, check if the item itself should be ignored
            if (shouldIgnore(relativePath, filterOptions)) {
                continue; // Skip this item and its potential children
            }
            if (item.isDirectory()) {
                // Recursively list files in subdirectory
                const subFiles = await listFilesRecursive(currentItemPath, rootPath, filterOptions);
                filesList = filesList.concat(subFiles);
            } else if (item.isFile()) {
                // Add file to the list (already passed the ignore check)
                filesList.push(relativePath);
            }
        }
    } catch (error) {
        // Log errors but try to continue if possible (e.g., permission denied on a subfolder)
        console.error(`Error reading directory ${startPath}:`, error.message);
        // Depending on the error type, you might want to re-throw or handle differently
        if (error.code === 'EACCES' || error.code === 'EPERM') {
           // Optionally inform the user about permission issues
        } else {
            throw error; // Re-throw unexpected errors
        }
    }
    return filesList;
}
/**
 * Main function to list files, including loading .gitignore.
 * @param {string} directoryPath The absolute path to the target directory.
 * @param {object} options Filter options.
 * @param {boolean} [options.useGitignore=true] Whether to use .gitignore rules.
 * @param {boolean} [options.ignoreGit=true] Whether to ignore the .git directory.
 * @param {string[]} [options.customBlacklist=[]] Custom blacklist items.
 * @returns {Promise<string[]>} A promise that resolves to an array of relative file paths.
 */
async function listFiles(directoryPath, { useGitignore = true, ignoreGit = true, customBlacklist = [] }) {
    let gitignoreInstance = null;
    if (useGitignore) {
        // Load .gitignore from the root directoryPath
        gitignoreInstance = await loadGitignore(directoryPath);
    }
    const filterOptions = {
        useGitignore,
        ignoreGit,
        customBlacklist,
        gitignoreInstance
    };
    // Start listing from the directoryPath itself, using it as the root for relative paths
    return await listFilesRecursive(directoryPath, directoryPath, filterOptions);
}
module.exports = {
    listFiles
};