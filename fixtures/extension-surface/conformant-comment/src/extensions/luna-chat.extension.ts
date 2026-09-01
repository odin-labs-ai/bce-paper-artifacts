import type { ExtensionFactory } from '@example/agent-harness';
import { buildServiceHeaders } from '../config.js'; // governed router, NOT 'openai' directly
export const lunaChatExtension: ExtensionFactory = (pi) => {
  pi.registerTool({ name: 'luna_chat', execute: async () => ({ h: buildServiceHeaders() }) });
};
export default lunaChatExtension;
