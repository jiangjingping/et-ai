/**
 * Web Worker for Safe Code Execution
 *
 * This script runs in an isolated environment, separate from the main UI thread.
 * It's responsible for executing data analysis code using Danfo.js.
 */

// Import Danfo.js. It will be available globally as 'dfd' in this worker.
import * as dfd from 'danfojs';

// The 'df' variable will hold the user's DataFrame.
let df = null;

/**
 * Executes code within the worker's scope.
 * @param {string} code The JavaScript code to execute.
 * @returns {any} The result of the last expression in the code.
 */
function execute(code) {
  // Using Function constructor for safer, scoped execution.
  // 'dfd' and 'df' are passed as arguments to the function.
  const func = new Function('dfd', 'df', code);
  return func(dfd, df);
}

// Listen for messages from the main thread
self.onmessage = (event) => {
  const { action, payload } = event.data;

  try {
    switch (action) {
      case 'loadData':
        // Create a DataFrame from the provided data
        df = new dfd.DataFrame(payload.data);
        self.postMessage({ status: 'success', action: 'loadData', message: 'Data loaded successfully.' });
        break;

      case 'executeCode':
        // Execute the provided code string
        const result = execute(payload.code);
        self.postMessage({ status: 'success', action: 'executeCode', result: result });
        break;

      case 'getEnvInfo':
        // Provide information about the current environment
        let envInfo = 'Danfo.js (dfd) is available.\n';
        if (df) {
          envInfo += `DataFrame 'df' is loaded with shape [${df.shape[0]}, ${df.shape[1]}].\n`;
          envInfo += `Columns: ${df.columns.join(', ')}`;
        } else {
          envInfo += 'No DataFrame is currently loaded.';
        }
        self.postMessage({ status: 'success', action: 'getEnvInfo', info: envInfo });
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    // If any error occurs, send it back to the main thread
    self.postMessage({
      status: 'error',
      action: action,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }
};
