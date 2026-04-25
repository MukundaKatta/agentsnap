/**
 * Minimal Anthropic SDK research-bot loop.
 *
 * Calls client.messages.create in a loop, executes any tool_use blocks,
 * and returns the model's final text. Tool execution goes through the
 * traceTool() wraps in tools.js, so a wrapping record() captures the
 * full trace.
 */
import Anthropic from '@anthropic-ai/sdk';

import { TOOL_SCHEMAS, TOOL_IMPLS } from './tools.js';

const MAX_ITERS = 8;

export async function runResearchBot({ model, prompt, system }) {
  const client = new Anthropic();
  const messages = [{ role: 'user', content: prompt }];

  let lastResponse;
  for (let i = 0; i < MAX_ITERS; i++) {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      ...(system ? { system } : {}),
      tools: TOOL_SCHEMAS,
      messages,
    });
    lastResponse = response;

    if (response.stop_reason !== 'tool_use') break;

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    const toolResults = await Promise.all(
      toolUses.map(async (use) => {
        const impl = TOOL_IMPLS[use.name];
        if (!impl) {
          return {
            type: 'tool_result',
            tool_use_id: use.id,
            content: `error: unknown tool '${use.name}'`,
            is_error: true,
          };
        }
        try {
          const result = await impl(use.input);
          return {
            type: 'tool_result',
            tool_use_id: use.id,
            content: JSON.stringify(result),
          };
        } catch (err) {
          return {
            type: 'tool_result',
            tool_use_id: use.id,
            content: `error: ${err.message}`,
            is_error: true,
          };
        }
      })
    );

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
  }

  return lastResponse.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
