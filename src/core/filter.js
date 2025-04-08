// src/core/filter.js
const fs = require('fs').promises;
const path = require('path');
const ignore = require('ignore'); // Ensure 'ignore' is installed via npm install ignore
// Default blacklist based on the final plan (includes .git)
const DEFAULT_BLACKLIST = [
    "node_modules", "dist", "build", "target", "bin", "obj", "vendor",
    ".git", ".idea", ".vscode", "__pycache__", "venv", "env", ".env",
    "coverage", "tmp", "temp"
];
// Common binary file extensions for basic filtering
const BINARY_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp', '.tif', '.tiff',
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',
    '.mp3', '.wav', '.ogg', '.m4a', '.flac',
    '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
    '.exe', '.dll', '.so', '.dylib', '.app',
    '.iso', '.img', '.dmg',
    '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', // Often treated as binary
    '.odt', '.ods', '.odp',
    '.eot', '.otf', '.ttf', '.woff', '.woff2', // Fonts
    '.jar', '.class',
    '.pyc', '.pyo',
    '.deb', '.rpm', '.msi', '.pkg'
]);
/**
 * Asynchronously loads and parses a .gitignore file from a given directory.
 * @param {string} directoryPath The directory to look for .gitignore in.
 * @returns {Promise<import('ignore').Ignore|null>} An ignore instance or null if no .gitignore found/readable.
 */
async function loadGitignore(directoryPath) {
    const gitignorePath = path.join(directoryPath, '.gitignore');
    try {
        const content = await fs.readFile(gitignorePath, 'utf8');
        const ig = ignore().add(content);
        return ig;
    } catch (error) {
        // If the file doesn't exist or other read errors occur, treat as no gitignore
        if (error.code === 'ENOENT') {
            // console.error(`.gitignore not found in ${directoryPath}`);
        } else {
            console.error(`Error reading .gitignore from ${directoryPath}:`, error.message);
        }
        return null;
    }
}
/**
 * Checks if a given file path should be ignored based on combined rules.
 * @param {string} relativePath The file path relative to the project root.
 * @param {object} options Filter options.
 * @param {boolean} [options.useGitignore=true] Whether to use .gitignore rules.
 * @param {boolean} [options.ignoreGit=true] Whether to ignore the .git directory.
 * @param {string[]} [options.customBlacklist=[]] Custom blacklist items.
 * @param {import('ignore').Ignore|null} options.gitignoreInstance Pre-loaded ignore instance.
 * @returns {boolean} True if the path should be ignored, false otherwise.
 */
function shouldIgnore(relativePath, { useGitignore = true, ignoreGit = true, customBlacklist = [], gitignoreInstance = null }) {
    // Normalize path separators to forward slashes for consistent matching
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const pathParts = normalizedPath.split('/').filter(part => part !== ''); // Get non-empty path segments
    // 1. Special handling for .git directory
    if (pathParts[0] === '.git') {
        if (!ignoreGit) {
            // Explicitly requested NOT to ignore .git
            return false; // Don't ignore, proceed to other checks if needed (though unlikely for .git)
        } else {
            // ignoreGit is true (or default), so ignore .git
             return true;
        }
        // Note: If ignoreGit is true, .git is already caught by DEFAULT_BLACKLIST below,
        // but explicit check here clarifies the override mechanism.
    }
    // 2. Check against custom blacklist (match any part of the path)
    if (customBlacklist && customBlacklist.length > 0) {
        const customSet = new Set(customBlacklist);
        if (pathParts.some(part => customSet.has(part))) {
            return true;
        }
        // Also check full path match for potential file patterns in custom list
        if (customSet.has(normalizedPath)) {
             return true;
        }
    }
    // 3. Check against default blacklist (match any part of the path)
    const defaultSet = new Set(DEFAULT_BLACKLIST);
    if (pathParts.some(part => defaultSet.has(part))) {
        // .git case already handled above if ignoreGit was false
        return true;
    }
    // 4. Check against .gitignore rules if applicable
    if (useGitignore && gitignoreInstance) {
        // ignore() expects paths relative to the .gitignore file's location
        // Our normalizedPath is already relative to the root where .gitignore should be
        if (gitignoreInstance.ignores(normalizedPath)) {
            return true;
        }
    }
    // 5. Check for binary file extensions
    const fileExtension = path.extname(normalizedPath).toLowerCase();
    if (BINARY_EXTENSIONS.has(fileExtension)) {
        return true;
    }
    // If none of the above rules matched, do not ignore
    return false;
}
module.exports = {
    loadGitignore,
    shouldIgnore,
    DEFAULT_BLACKLIST, // Exporting for potential reference elsewhere if needed
    BINARY_EXTENSIONS
};