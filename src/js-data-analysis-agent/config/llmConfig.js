/**
 * LLM Configuration
 *
 * It's recommended to use environment variables for sensitive data like API keys.
 * In a Vite project, you can create a .env.local file in the root directory:
 * VITE_OPENAI_API_KEY=your_api_key_here
 * VITE_OPENAI_BASE_URL=https://api.openai.com/v1
 */

export const llmConfig = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || 'YOUR_API_KEY_HERE',
  baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  model: 'gpt-4', // Or any other model you prefer
  temperature: 0.1,
  max_tokens: 4000,
};
