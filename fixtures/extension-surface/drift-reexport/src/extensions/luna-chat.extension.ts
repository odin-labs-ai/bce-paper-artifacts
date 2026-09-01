import type { ExtensionFactory } from '@example/agent-harness';
export { default as OpenAI } from 'openai'; // FORBIDDEN re-export
export const lunaChatExtension: ExtensionFactory = (pi) => { pi.registerTool({ name: 'luna_chat' }); };
export default lunaChatExtension;
