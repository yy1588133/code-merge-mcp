// src/core/compressor.js
/**
 * Basic code compression function.
 * Removes multi-line comments, single-line comments (heuristic),
 * multiple consecutive empty lines, and leading/trailing whitespace on lines.
 * Note: This is a basic implementation and might not be safe for all languages or complex cases.
 * @param {string} code The code content to compress.
 * @returns {string} The compressed code.
 */
function compressContent(code) {
    if (!code) {
        return '';
    }
    try {
        let compressed = code;
        // Remove multi-line comments /* ... */
        compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, '');
        // Remove single-line comments // ... (basic, might affect URLs in strings)
        // Consider using a more robust parser if // inside strings is common.
        compressed = compressed.replace(/(?<!:)\/\/.*$/gm, ''); // Avoid matching http://
        // Remove multiple consecutive empty lines (more than 2) into a single one
        compressed = compressed.replace(/(\r?\n\s*){3,}/g, '\n\n');
        // Trim leading/trailing whitespace from each line
        compressed = compressed.split(/\r?\n/).map(line => line.trim()).join('\n');
        // Remove leading/trailing empty lines from the whole string
        compressed = compressed.trim();
        return compressed;
    } catch (error) {
        console.error('Error during content compression:', error.message);
        return code; // Return original code on error
    }
}
module.exports = {
    compressContent
};