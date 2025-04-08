// src/tools/analyze_code.js
const path = require('path');
const fs = require('fs').promises;
const { readFiles } = require('../core/file-reader');

/**
 * Performs a simple code analysis on the given file or directory.
 * @param {object} parameters Request parameters.
 * @param {string} parameters.path The target file or directory path.
 * @param {string} [parameters.language] Optional language filter.
 * @param {boolean} [parameters.countLines=true] Whether to count lines of code.
 * @param {boolean} [parameters.countFunctions=true] Whether to count functions.
 * @returns {Promise<object>} The result object containing the analysis.
 */
async function handleRequest(parameters) {
    console.error('analyze_code: Starting execution');
    const startTime = Date.now();

    const { path: targetPath, language, countLines = true, countFunctions = true } = parameters;
    if (!targetPath) {
        throw new Error("Missing required parameter: 'path'.");
    }

    // Resolve to absolute path
    const absolutePath = path.resolve(targetPath);
    console.error(`analyze_code: Resolved path to ${absolutePath}`);

    let rootPath = absolutePath; // Assume path is directory initially
    let filesToProcess = [];

    // Validate path existence and determine if it's a file or directory
    try {
        const stats = await fs.stat(absolutePath);
        console.error(`analyze_code: Path exists, checking type`);

        if (stats.isDirectory()) {
            // Path is a directory, list files within it
            console.error(`analyze_code: Path is a directory, listing files`);
            rootPath = absolutePath; // Keep rootPath as the directory itself

            // Get all files in the directory recursively
            filesToProcess = await listFilesRecursive(absolutePath);
            
            // Filter by language if specified
            if (language) {
                const extensions = getExtensionsForLanguage(language);
                filesToProcess = filesToProcess.filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return extensions.includes(ext);
                });
            }
            
            console.error(`analyze_code: Found ${filesToProcess.length} files to analyze`);

        } else if (stats.isFile()) {
            // Path is a single file
            console.error(`analyze_code: Path is a file`);
            rootPath = path.dirname(absolutePath); // Set rootPath to the parent directory
            const relativeFilePath = path.basename(absolutePath);

            // Check if language filter applies
            if (language) {
                const extensions = getExtensionsForLanguage(language);
                const ext = path.extname(relativeFilePath).toLowerCase();
                if (!extensions.includes(ext)) {
                    console.error(`analyze_code: File ${relativeFilePath} does not match language filter ${language}`);
                    filesToProcess = []; // Skip if language doesn't match
                } else {
                    filesToProcess.push(relativeFilePath);
                }
            } else {
                filesToProcess.push(relativeFilePath);
            }
            
            console.error(`analyze_code: Added single file to process: ${relativeFilePath}`);
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
        // If no files are left after filtering
        console.error(`analyze_code: No files to process, returning empty analysis`);
        return { 
            analysis: {
                totalFiles: 0,
                totalLines: 0,
                totalFunctions: 0,
                fileBreakdown: []
            }
        };
    }

    // Read the content of the files
    console.error(`analyze_code: Reading content of ${filesToProcess.length} files`);
    const fileContentsMap = await readFiles(filesToProcess, rootPath);

    // Analyze the files
    console.error(`analyze_code: Analyzing files`);
    const analysis = {
        totalFiles: filesToProcess.length,
        totalLines: 0,
        totalFunctions: 0,
        fileBreakdown: []
    };

    // Sort file paths before analyzing for deterministic output
    const sortedRelativePaths = [...fileContentsMap.keys()].sort((a, b) => a.localeCompare(b));

    for (const relativeFilePath of sortedRelativePaths) {
        const content = fileContentsMap.get(relativeFilePath);
        if (content !== undefined) { // Check if file read was successful
            const fileAnalysis = {
                file: relativeFilePath,
                lines: 0,
                functions: 0
            };

            // Count lines if requested
            if (countLines) {
                fileAnalysis.lines = content.split('\n').length;
                analysis.totalLines += fileAnalysis.lines;
            }

            // Count functions if requested
            if (countFunctions) {
                fileAnalysis.functions = countFunctionsInCode(content, path.extname(relativeFilePath));
                analysis.totalFunctions += fileAnalysis.functions;
            }

            analysis.fileBreakdown.push(fileAnalysis);
        }
    }

    const executionTime = Date.now() - startTime;
    console.error(`analyze_code: Execution completed in ${executionTime}ms`);

    return {
        analysis
    };
}

/**
 * Helper function to recursively list files in a directory
 * @param {string} dir Directory to list files from
 * @returns {Promise<string[]>} Array of relative file paths
 */
async function listFilesRecursive(dir, baseDir = dir, result = []) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);
        
        if (entry.isDirectory()) {
            await listFilesRecursive(fullPath, baseDir, result);
        } else if (entry.isFile()) {
            result.push(relativePath);
        }
    }
    
    return result;
}

/**
 * Get file extensions for a given language
 * @param {string} language Programming language
 * @returns {string[]} Array of file extensions
 */
function getExtensionsForLanguage(language) {
    const languageMap = {
        'javascript': ['.js', '.jsx', '.mjs'],
        'typescript': ['.ts', '.tsx'],
        'python': ['.py', '.pyw'],
        'java': ['.java'],
        'c': ['.c', '.h'],
        'cpp': ['.cpp', '.hpp', '.cc', '.hh', '.cxx', '.hxx'],
        'csharp': ['.cs'],
        'go': ['.go'],
        'ruby': ['.rb'],
        'php': ['.php'],
        'swift': ['.swift'],
        'rust': ['.rs'],
        'html': ['.html', '.htm'],
        'css': ['.css'],
        'json': ['.json']
    };
    
    return languageMap[language.toLowerCase()] || [];
}

/**
 * Simple function to count functions in code
 * @param {string} code Code content
 * @param {string} fileExtension File extension to determine language
 * @returns {number} Number of functions found
 */
function countFunctionsInCode(code, fileExtension) {
    // This is a very simple implementation and won't catch all functions
    // A real implementation would use language-specific parsers
    let count = 0;
    
    // JavaScript/TypeScript
    if (['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(fileExtension.toLowerCase())) {
        // Count function declarations
        const functionMatches = code.match(/function\s+\w+\s*\(/g) || [];
        count += functionMatches.length;
        
        // Count arrow functions
        const arrowMatches = code.match(/\w+\s*=\s*\([^)]*\)\s*=>/g) || [];
        count += arrowMatches.length;
        
        // Count method definitions
        const methodMatches = code.match(/\w+\s*\([^)]*\)\s*{/g) || [];
        count += methodMatches.length;
    }
    // Python
    else if (['.py', '.pyw'].includes(fileExtension.toLowerCase())) {
        const functionMatches = code.match(/def\s+\w+\s*\(/g) || [];
        count += functionMatches.length;
    }
    // Java
    else if (['.java'].includes(fileExtension.toLowerCase())) {
        // This is a very simplified approach
        const methodMatches = code.match(/\w+\s+\w+\s*\([^)]*\)\s*{/g) || [];
        count += methodMatches.length;
    }
    
    return count;
}

module.exports = {
    handleRequest,
    handler: handleRequest // Export as handler for compatibility with stdio-handler.js
};
