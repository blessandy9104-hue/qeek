import { definePlugin } from '@deepseek-ai/dsh-core';

export const assistantConversation = definePlugin({
  name: 'assistant-conversation',
  description: 'Conversation nodes and chat UI components',

  setup(ctx) {
    ctx.register('conversation-nodes', [
      {
        type: 'user-message',
        component: 'UserMessageNode',
        props: { showTimestamp: true, showAvatar: true }
      },
      {
        type: 'assistant-message',
        component: 'AssistantMessageNode',
        props: { showTimestamp: true, showAvatar: true, renderMarkdown: true, renderCode: true }
      },
      {
        type: 'tool-call',
        component: 'ToolCallNode',
        props: { showInput: true, showOutput: true, collapsible: true }
      },
      {
        type: 'tool-result',
        component: 'ToolResultNode',
        props: { showOutput: true, syntaxHighlight: true }
      },
      {
        type: 'thinking',
        component: 'ThinkingNode',
        props: { animated: true }
      },
      {
        type: 'skill-invocation',
        component: 'SkillInvocationNode',
        props: { showProgress: true }
      },
      {
        type: 'math-verification',
        component: 'MathVerificationNode',
        props: { showCertificate: true }
      },
      {
        type: 'memory-reference',
        component: 'MemoryReferenceNode',
        props: { showPreview: true }
      }
    ]);

    ctx.register('conversation-features', {
      streaming: true,
      branching: true,
      editing: true,
      regeneration: true,
      pinning: true,
      sharing: true,
      export: ['markdown', 'json', 'pdf']
    });

    ctx.register('conversation-layout', {
      sidebar: { enabled: true, width: 280, collapsible: true },
      input: { type: 'composer', maxHeight: 300, attachments: true },
      toolbar: { search: true, filter: true, settings: true }
    });
  }
});

export default assistantConversation;