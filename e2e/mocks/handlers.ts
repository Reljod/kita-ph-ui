import type { Page } from '@playwright/test';
import crypto from 'node:crypto';

function uuidv4() {
  return crypto.randomUUID();
}

function json(status: number, body: unknown) {
  return {
    status,
    contentType: 'application/json' as const,
    body: JSON.stringify(body),
  };
}

// Stateful in-memory stores
const agents = [
  {
    id: 'agent-1',
    name: 'ResearchBot',
    role: 'Research Assistant',
    goal: 'Help users find and synthesize information',
    backstory: 'Expert in research and data analysis',
    llm_id: 'llm-1',
    color: 'bg-blue-600',
    updated_at: '2025-06-01T10:00:00Z',
    tools: ['tool-1'],
  },
  {
    id: 'agent-2',
    name: 'DevHelper',
    role: 'Coding Assistant',
    goal: 'Help with software development tasks',
    backstory: 'Experienced software engineer',
    llm_id: 'llm-2',
    color: 'bg-emerald-600',
    updated_at: '2025-06-02T10:00:00Z',
    tools: ['tool-1', 'tool-2'],
  },
];

const memories = [
  {
    id: 'mem-1',
    org_id: 'org-1',
    content: 'User prefers concise responses with bullet points',
    title: 'User Greeting Preferences',
    status: 'completed' as const,
    updated_at: '2025-06-05T10:00:00Z',
  },
  {
    id: 'mem-2',
    org_id: 'org-1',
    agent_id: 'agent-1',
    content: 'ResearchBot should prioritize peer-reviewed sources',
    title: 'Research Source Priority',
    status: 'completed' as const,
    updated_at: '2025-06-06T10:00:00Z',
  },
];

const files = [
  {
    id: 'file-1',
    filename: 'project_requirements.pdf',
    extension: 'pdf',
    size: 204800,
    content_type: 'application/pdf',
    org_id: 'org-1',
    status: 'completed' as const,
    created_at: '2025-06-03T10:00:00Z',
    updated_at: '2025-06-03T10:00:00Z',
  },
  {
    id: 'file-2',
    filename: 'api_documentation.md',
    extension: 'md',
    size: 102400,
    content_type: 'text/markdown',
    org_id: 'org-1',
    agent_id: 'agent-1',
    status: 'completed' as const,
    created_at: '2025-06-04T10:00:00Z',
    updated_at: '2025-06-04T10:00:00Z',
  },
];

const tools = [
  { id: 'tool-1', name: 'Web Search', description: 'Search the web for up-to-date information', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  { id: 'tool-2', name: 'Code Interpreter', description: 'Execute and analyze code snippets in a sandbox', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
  { id: 'tool-3', name: 'Memory Search', description: 'Search through stored memories and knowledge', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
];

const chats = [
  { id: 'chat-1', preview: 'Hello, how can you help me?', updated_at: '2025-06-10T10:00:00Z' },
  { id: 'chat-2', preview: 'What is the weather today?', updated_at: '2025-06-11T10:00:00Z' },
];

const messages = [
  { id: 'msg-1', role: 'user', content: 'Hello, how can you help me?' },
  { id: 'msg-2', role: 'agent', content: 'I can help you with research, coding, and more!' },
];

const llms = [
  { id: 'llm-1', name: 'GPT-4o', provider: 'OpenAI', model: 'gpt-4o' },
  { id: 'llm-2', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', model: 'claude-3-5-sonnet' },
];

function seededState() {
  return {
    agents: [
      {
        id: 'agent-1',
        name: 'ResearchBot',
        role: 'Research Assistant',
        goal: 'Help users find and synthesize information',
        backstory: 'Expert in research and data analysis',
        llm_id: 'llm-1',
        color: 'bg-blue-600',
        updated_at: '2025-06-01T10:00:00Z',
        tools: ['tool-1'],
      },
      {
        id: 'agent-2',
        name: 'DevHelper',
        role: 'Coding Assistant',
        goal: 'Help with software development tasks',
        backstory: 'Experienced software engineer',
        llm_id: 'llm-2',
        color: 'bg-emerald-600',
        updated_at: '2025-06-02T10:00:00Z',
        tools: ['tool-1', 'tool-2'],
      },
    ],
    memories: [
      {
        id: 'mem-1',
        org_id: 'org-1',
        content: 'User prefers concise responses with bullet points',
        title: 'User Greeting Preferences',
        status: 'completed' as const,
        updated_at: '2025-06-05T10:00:00Z',
      },
      {
        id: 'mem-2',
        org_id: 'org-1',
        agent_id: 'agent-1',
        content: 'ResearchBot should prioritize peer-reviewed sources',
        title: 'Research Source Priority',
        status: 'completed' as const,
        updated_at: '2025-06-06T10:00:00Z',
      },
    ],
    files: [
      {
        id: 'file-1',
        filename: 'project_requirements.pdf',
        extension: 'pdf',
        size: 204800,
        content_type: 'application/pdf',
        org_id: 'org-1',
        status: 'completed' as const,
        created_at: '2025-06-03T10:00:00Z',
        updated_at: '2025-06-03T10:00:00Z',
      },
      {
        id: 'file-2',
        filename: 'api_documentation.md',
        extension: 'md',
        size: 102400,
        content_type: 'text/markdown',
        org_id: 'org-1',
        agent_id: 'agent-1',
        status: 'completed' as const,
        created_at: '2025-06-04T10:00:00Z',
        updated_at: '2025-06-04T10:00:00Z',
      },
    ],
  };
}

export function resetMockState() {
  const seed = seededState();
  agents.length = 0;
  agents.push(...seed.agents);
  memories.length = 0;
  memories.push(...seed.memories);
  files.length = 0;
  files.push(...seed.files);
}

export async function setupApiMocks(page: Page) {
  resetMockState();

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    // Only mock API calls to the backend (port 8000)
    if (!url.host.includes('localhost:8000')) {
      await route.fallback();
      return;
    }

    try {
      // --- AUTH ---
      if (path.startsWith('/auth/')) {
        if (path === '/auth/login' && method === 'POST') {
          await route.fulfill(json(200, {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            token_type: 'bearer',
            user_id: 'user-1',
            org_id: 'org-1',
          }));
          return;
        }
        if (path === '/auth/refresh') {
          await route.fulfill(json(200, { access_token: 'refreshed-token', refresh_token: 'refreshed-refresh-token' }));
          return;
        }
        await route.fulfill(json(200, {}));
        return;
      }

      // --- AGENT CHAT SSE (POST - must come before GET) ---
      if (path.match(/^\/agent\/[^/]+\/chat(?:\/[^/]+\/continue)?$/) && method === 'POST') {
        const sseData = [
          'data: {"type": "content", "content": "Hello! How can I assist you?"}',
          'data: {"type": "done", "messages": [{"id":"m1","role":"user","content":"test"},{"id":"m2","role":"agent","content":"Hello! How can I assist you?"}]}',
        ].join('\n') + '\n\n';
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
          body: sseData,
        });
        return;
      }

      // --- AGENT CHAT ---
      const chatMsgsMatch = path.match(/^\/agent\/([^/]+)\/chat\/([^/]+)$/);
      if (chatMsgsMatch) {
        await route.fulfill(json(200, { id: chatMsgsMatch[2], messages }));
        return;
      }

      const agentChatMatch = path.match(/^\/agent\/([^/]+)\/chat/);
      if (agentChatMatch) {
        await route.fulfill(json(200, chats));
        return;
      }

      // --- AGENT MEMORY ---
      const agentMemMatch = path.match(/^\/agent\/([^/]+)\/memory(?:\/([^/]+))?$/);
      if (agentMemMatch) {
        const [, agentId, memId] = agentMemMatch;
        if (method === 'GET') {
          await route.fulfill(json(200, memories.filter(m => m.agent_id === agentId)));
          return;
        }
        if (method === 'POST') {
          const body = JSON.parse(route.request().postData() || '{}');
          const created = { id: uuidv4(), org_id: 'org-1', agent_id: agentId, ...body, status: 'completed', updated_at: new Date().toISOString() };
          memories.push(created);
          await route.fulfill(json(201, created));
          return;
        }
        if (method === 'PUT' && memId) {
          const body = JSON.parse(route.request().postData() || '{}');
          const idx = memories.findIndex(m => m.id === memId);
          if (idx !== -1) {
            memories[idx] = { ...memories[idx], ...body, updated_at: new Date().toISOString() };
            await route.fulfill(json(200, memories[idx]));
          } else {
            await route.fulfill(json(404, { detail: 'Memory not found' }));
          }
          return;
        }
        if (method === 'DELETE' && memId) {
          const idx = memories.findIndex(m => m.id === memId);
          if (idx !== -1) memories.splice(idx, 1);
          await route.fulfill({ status: 204, body: '' });
          return;
        }
      }

      // --- AGENT TOOLS ---
      const agentToolsMatch = path.match(/^\/agent\/([^/]+)\/tools\/(add|remove)$/);
      if (agentToolsMatch) {
        const [, agentId, action] = agentToolsMatch;
        const body = JSON.parse(route.request().postData() || '{}');
        const idx = agents.findIndex(a => a.id === agentId);
        if (idx !== -1) {
          if (action === 'add') {
            agents[idx].tools = [...agents[idx].tools, body.tool_id];
          } else {
            agents[idx].tools = agents[idx].tools.filter(t => t !== body.tool_id);
          }
          await route.fulfill(json(200, { message: 'Tool updated', tools: agents[idx].tools }));
        } else {
          await route.fulfill(json(404, { detail: 'Agent not found' }));
        }
        return;
      }

      // --- AGENT SINGLE ---
      const agentSingleMatch = path.match(/^\/agent\/([^/]+)$/);
      if (agentSingleMatch) {
        const agentId = agentSingleMatch[1];
        if (method === 'GET') {
          const agent = agents.find(a => a.id === agentId);
          await route.fulfill(agent ? json(200, agent) : json(404, { detail: 'Agent not found' }));
          return;
        }
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          const idx = agents.findIndex(a => a.id === agentId);
          if (idx !== -1) {
            agents[idx] = { ...agents[idx], ...body, updated_at: new Date().toISOString() };
            await route.fulfill(json(200, agents[idx]));
          } else {
            await route.fulfill(json(404, { detail: 'Agent not found' }));
          }
          return;
        }
      }

      // --- AGENT LIST ---
      if (path === '/agent' || path === '/agent/') {
        if (method === 'GET') {
          await route.fulfill(json(200, agents));
          return;
        }
        if (method === 'POST') {
          const body = JSON.parse(route.request().postData() || '{}');
          const created = { id: uuidv4(), ...body, tools: [], updated_at: new Date().toISOString() };
          agents.push(created);
          await route.fulfill(json(201, created));
          return;
        }
      }

      // --- MEMORY ---
      const memIdMatch = path.match(/^\/memory\/([^/]+)$/);
      if (memIdMatch) {
        const memId = memIdMatch[1];
        if (method === 'PUT') {
          const body = JSON.parse(route.request().postData() || '{}');
          const idx = memories.findIndex(m => m.id === memId);
          if (idx !== -1) {
            memories[idx] = { ...memories[idx], ...body, updated_at: new Date().toISOString() };
            await route.fulfill(json(200, memories[idx]));
          } else {
            await route.fulfill(json(404, { detail: 'Memory not found' }));
          }
          return;
        }
        if (method === 'DELETE') {
          const idx = memories.findIndex(m => m.id === memId);
          if (idx !== -1) memories.splice(idx, 1);
          await route.fulfill({ status: 204, body: '' });
          return;
        }
      }

      if (path === '/memory/search') {
        const query = url.searchParams.get('query') || '';
        const filtered = memories.filter(m =>
          m.title.toLowerCase().includes(query.toLowerCase()) ||
          m.content.toLowerCase().includes(query.toLowerCase())
        );
        await route.fulfill(json(200, filtered));
        return;
      }

      if (path === '/memory' || path === '/memory/') {
        if (method === 'GET') {
          await route.fulfill(json(200, memories));
          return;
        }
        if (method === 'POST') {
          const body = JSON.parse(route.request().postData() || '{}');
          const created = { id: uuidv4(), org_id: 'org-1', ...body, status: 'completed', updated_at: new Date().toISOString() };
          memories.push(created);
          await route.fulfill(json(201, created));
          return;
        }
      }

      // --- FILES ---
      const fileCompleteMatch = path.match(/^\/files\/([^/]+)\/complete$/);
      if (fileCompleteMatch) {
        await route.fulfill(json(200, { message: 'Upload completed' }));
        return;
      }

      const fileSingleMatch = path.match(/^\/files\/([^/]+)$/);
      if (fileSingleMatch) {
        const fileId = fileSingleMatch[1];
        if (method === 'PATCH') {
          const body = JSON.parse(route.request().postData() || '{}');
          const idx = files.findIndex(f => f.id === fileId);
          if (idx !== -1) {
            files[idx] = { ...files[idx], ...body, updated_at: new Date().toISOString() };
            await route.fulfill(json(200, files[idx]));
          } else {
            await route.fulfill(json(404, { detail: 'File not found' }));
          }
          return;
        }
        if (method === 'DELETE') {
          const idx = files.findIndex(f => f.id === fileId);
          if (idx !== -1) files.splice(idx, 1);
          await route.fulfill({ status: 204, body: '' });
          return;
        }
      }

      if (path === '/files/upload') {
        const body = JSON.parse(route.request().postData() || '{}');
        const fileId = uuidv4();
        const created: typeof files[number] = {
          id: fileId,
          filename: body.filename || 'uploaded.txt',
          extension: (body.filename || 'uploaded.txt').split('.').pop() || 'txt',
          size: body.size || 0,
          content_type: body.content_type || 'text/plain',
          org_id: 'org-1',
          agent_id: body.agent_id,
          status: 'completed' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        files.push(created);
        await route.fulfill(json(201, {
          file_id: fileId,
          upload_url: `https://storage.example.com/upload/${fileId}`,
          method: 'POST',
          token: 'mock-token',
        }));
        return;
      }

      if (path === '/files' || path === '/files/') {
        await route.fulfill(json(200, files));
        return;
      }

      // --- TOOLS ---
      const toolAgentsMatch = path.match(/^\/tool\/([^/]+)\/agents$/);
      if (toolAgentsMatch) {
        await route.fulfill(json(200, agents));
        return;
      }

      const toolSingleMatch = path.match(/^\/tool\/([^/]+)$/);
      if (toolSingleMatch) {
        const tool = tools.find(t => t.id === toolSingleMatch[1]);
        await route.fulfill(tool ? json(200, tool) : json(404, { detail: 'Tool not found' }));
        return;
      }

      if (path === '/tool' || path === '/tool/') {
        await route.fulfill(json(200, tools));
        return;
      }

      // --- LLM ---
      if (path === '/llm' || path === '/llm/') {
        await route.fulfill(json(200, llms));
        return;
      }

      // --- USER ---
      if (path === '/user/me') {
        await route.fulfill(json(200, { id: 'user-1', email: 'test@kita.ai', name: 'TestUser', org_id: 'org-1' }));
        return;
      }

      // --- ORG ---
      if (path.startsWith('/org/')) {
        await route.fulfill(json(200, { id: 'org-1', name: 'Kita AI', code: 'KITA-123' }));
        return;
      }

      // Unknown API path – let it pass through
      await route.fallback();
    } catch (e) {
      console.error(`[MSW] Error handling ${method} ${path}:`, e);
      await route.fallback();
    }
  });
}
