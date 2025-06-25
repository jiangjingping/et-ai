/**
 * Code Executor
 *
 * This class acts as a bridge between the main application thread and the Web Worker.
 * It manages the lifecycle of the worker and provides a simple, promise-based API
 * for executing code and managing the worker's state.
 */
export class CodeExecutor {
  constructor() {
    // Create a new Web Worker instance from the worker script.
    // The { type: 'module' } option is crucial for allowing 'import' statements in the worker.
    this.worker = new Worker(new URL('./worker.js', import.meta.url), {
      type: 'module',
    });

    this.messageHandlers = new Map();
    this.nextMessageId = 0;

    this.worker.onmessage = (event) => {
      const { messageId, ...data } = event.data;
      if (this.messageHandlers.has(messageId)) {
        const handler = this.messageHandlers.get(messageId);
        handler(data);
        this.messageHandlers.delete(messageId);
      }
    };

    this.worker.onerror = (error) => {
      console.error('Error in CodeExecutor Worker:', error);
      // Handle potential worker-level errors, perhaps by rejecting all pending promises.
    };
  }

  /**
   * Sends a message to the worker and returns a promise that resolves with the response.
   * @param {string} action The action to perform in the worker.
   * @param {object} payload The data to send with the action.
   * @returns {Promise<any>} A promise that resolves with the worker's response.
   */
  _postMessage(action, payload) {
    return new Promise((resolve, reject) => {
      const messageId = this.nextMessageId++;
      this.messageHandlers.set(messageId, (response) => {
        if (response.status === 'success') {
          resolve(response);
        } else {
          reject(response.error);
        }
      });
      this.worker.postMessage({ messageId, action, payload });
    });
  }

  /**
   * Loads data into the worker's environment, creating a DataFrame.
   * @param {Array<object>} data The raw data, typically an array of objects.
   * @returns {Promise<string>} A promise that resolves with a success message.
   */
  async loadData(data) {
    const response = await this._postMessage('loadData', { data });
    return response.message;
  }

  /**
   * Executes a string of JavaScript code in the worker.
   * @param {string} code The code to execute.
   * @returns {Promise<any>} A promise that resolves with the result of the code execution.
   */
  async executeCode(code) {
    const response = await this._postMessage('executeCode', { code });
    return response.result;
  }

  /**
   * Retrieves information about the worker's current environment.
   * @returns {Promise<string>} A promise that resolves with the environment info string.
   */
  async getEnvironmentInfo() {
    const response = await this._postMessage('getEnvInfo', {});
    return response.info;
  }

  /**
   * Terminates the Web Worker to free up resources.
   */
  terminate() {
    this.worker.terminate();
  }
}
