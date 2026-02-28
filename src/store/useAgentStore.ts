import { create } from 'zustand';

export interface Message {
    id: string | number;
    role: 'user' | 'agent' | 'builder';
    content: string;
}

export interface ChatItem {
    id: string;
    preview: string;
    updated_at: string;
}

export interface Agent {
    id: string;
    name: string;
    role: string;
    avatar: string;
    color: string;
    messages: Message[];
    chatId?: string;
    chats?: ChatItem[];
}

interface AgentState {
    agents: Agent[];
    activeAgentId: string | null;
    setAgents: (agents: Agent[]) => void;
    addAgent: (agent: Agent) => void;
    removeAgent: (id: string) => void;
    setActiveAgent: (id: string | null) => void;
    setAgentChatId: (agentId: string, chatId: string) => void;
    setAgentChats: (agentId: string, chats: ChatItem[]) => void;
    addMessage: (agentId: string, message: Message) => void;
    setMessages: (agentId: string, messages: Message[]) => void;
    reorderAgents: (startIndex: number, endIndex: number) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
    agents: [],
    activeAgentId: null,

    setAgents: (agents) => set({ agents }),

    addAgent: (agent) =>
        set((state) => ({ agents: [...state.agents, agent] })),

    removeAgent: (id) =>
        set((state) => ({
            agents: state.agents.filter((a) => a.id !== id),
            activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
        })),

    setActiveAgent: (id) => set({ activeAgentId: id }),
    setAgentChatId: (agentId, chatId) =>
        set((state) => ({
            agents: state.agents.map((agent) =>
                agent.id === agentId ? { ...agent, chatId } : agent
            ),
        })),

    setAgentChats: (agentId, chats) =>
        set((state) => ({
            agents: state.agents.map((agent) =>
                agent.id === agentId ? { ...agent, chats } : agent
            ),
        })),

    addMessage: (agentId, message) =>
        set((state) => ({
            agents: state.agents.map((agent) =>
                agent.id === agentId
                    ? { ...agent, messages: [...agent.messages, message] }
                    : agent
            ),
        })),

    setMessages: (agentId, messages) =>
        set((state) => ({
            agents: state.agents.map((agent) =>
                agent.id === agentId ? { ...agent, messages } : agent
            ),
        })),

    reorderAgents: (startIndex, endIndex) =>
        set((state) => {
            const result = Array.from(state.agents);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return { agents: result };
        }),
}));
