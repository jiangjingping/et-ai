import yaml from 'js-yaml';

/**
 * @file yamlParser.js
 * @description A utility for parsing YAML strings from LLM responses
 * using the js-yaml library.
 */

/**
 * Extracts and parses a YAML block from a string.
 * @param {string} text The text containing the YAML block.
 * @returns {object|null} The parsed JavaScript object or null if parsing fails.
 */
export function parseYaml(text) {
    try {
        // Find the YAML block, which might be enclosed in ```yaml ... ```
        const match = text.match(/```yaml\n([\s\S]*?)\n```/);
        
        let yamlString;
        if (match && match[1]) {
            // If a fenced code block is found, use its content
            yamlString = match[1];
        } else {
            // Otherwise, assume the whole string is YAML
            yamlString = text;
        }

        // Use js-yaml to safely load the YAML string
        const data = yaml.load(yamlString);
        
        // Ensure the result is an object
        if (typeof data === 'object' && data !== null) {
            return data;
        } else {
            console.warn("Parsed YAML is not an object:", data);
            return null;
        }

    } catch (error) {
        console.error("Failed to parse YAML:", error);
        return null;
    }
}
