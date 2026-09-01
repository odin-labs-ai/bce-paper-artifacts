import type { ExtensionFactory } from '@example/agent-harness';
export const lunaChatExtension: ExtensionFactory = (pi) => {
  pi.registerTool({ name: 'luna_chat', load: async () => await import(`openai`) }); // backtick dynamic
};
export default lunaChatExtension;
