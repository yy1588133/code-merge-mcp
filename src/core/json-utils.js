// src/core/json-utils.js
/**
 * Utility functions for handling JSON serialization safely
 */

/**
 * Ensures text content is safe for JSON serialization.
 * This function handles special characters that might cause JSON parsing issues.
 * 
 * @param {string} text The text content to make JSON-safe
 * @returns {string} JSON-safe text content
 */
function makeJsonSafe(text) {
    if (text === null || text === undefined) {
        return '';
    }
    
    // The safest approach is to use JSON.stringify on the string itself
    // This properly escapes all special characters according to JSON spec
    const jsonSafeText = JSON.stringify(String(text)).slice(1, -1);
    
    return jsonSafeText;
}

/**
 * Safely converts an object to a JSON string, handling special characters
 * in string values that might cause JSON parsing issues.
 * 
 * @param {object} obj The object to convert to JSON
 * @param {number} [indent=2] Optional indentation for pretty printing
 * @returns {string} JSON string representation of the object
 */
function safeJsonStringify(obj, indent = 2) {
    if (!obj) {
        return '{}';
    }
    
    try {
        return JSON.stringify(obj, null, indent);
    } catch (error) {
        console.error('Error in JSON.stringify:', error.message);
        
        // Fallback: manually handle problematic string values
        const processedObj = deepProcessObject(obj);
        return JSON.stringify(processedObj, null, indent);
    }
}

/**
 * Deep processes an object to ensure all string values are JSON-safe
 * 
 * @param {any} value The value to process
 * @returns {any} Processed value with all strings made JSON-safe
 */
function deepProcessObject(value) {
    if (value === null || value === undefined) {
        return value;
    }
    
    if (typeof value === 'string') {
        // For strings, we don't need to call makeJsonSafe here
        // as JSON.stringify will handle the escaping
        return value;
    }
    
    if (Array.isArray(value)) {
        return value.map(item => deepProcessObject(item));
    }
    
    if (typeof value === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = deepProcessObject(val);
        }
        return result;
    }
    
    return value;
}

module.exports = {
    makeJsonSafe,
    safeJsonStringify,
    deepProcessObject
};
