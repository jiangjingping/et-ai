import { llmConfig } from '../config/llmConfig.js';

/**
 * Calls the LLM API with the provided messages.
 * @param {Array<object>} messages The array of message objects to send.
 * @returns {Promise<string>} A promise that resolves with the text content of the LLM's response.
 */
export async function callLLMApi(messages) {
  const { apiKey, baseUrl, model, temperature, max_tokens } = llmConfig;

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('OpenAI API key is not configured. Please set VITE_OPENAI_API_KEY in your .env.local file.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const body = JSON.stringify({
    model: model,
    messages: messages,
    temperature: temperature,
    max_tokens: max_tokens,
  });

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`API request failed with status ${response.status}: ${errorBody.error.message}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling LLM API:', error);
    throw error;
  }
}
