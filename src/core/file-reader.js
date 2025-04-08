// src/core/file-reader.js
const fs = require('fs').promises;
const path = require('path');
/**
 * Reads the content of multiple files asynchronously.
 * @param {string[]} relativeFilePaths An array of file paths relative to the root path.
 * @param {string} rootPath The absolute path of the project root.
 * @returns {Promise<Map<string, string>>} A promise that resolves to a Map where keys are
 *                                        relative file paths and values are file contents.
 *                                        Files that couldn't be read will be omitted.
 */
async function readFiles(relativeFilePaths, rootPath) {
    const fileContents = new Map();
    const readPromises = relativeFilePaths.map(async (relativeFilePath) => {
        const absolutePath = path.join(rootPath, relativeFilePath);
        try {
            // Attempt to read the file as UTF-8 text
            const content = await fs.readFile(absolutePath, 'utf8');
            fileContents.set(relativeFilePath, content);
        } catch (error) {
            console.error(`Error reading file ${absolutePath}:`, error.message);
            // Optionally: Log specific error types like encoding issues
            // fileContents.set(relativeFilePath, `Error reading file: ${error.message}`); // Or skip adding it
        }
    });
    // Wait for all read operations to complete (or fail individually)
    await Promise.allSettled(readPromises);
    return fileContents;
}
module.exports = {
    readFiles
};