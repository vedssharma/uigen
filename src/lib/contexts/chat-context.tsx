"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useMemo,
} from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { Message } from "ai";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";

interface ChatContextProps {
  projectId?: string;
  initialMessages?: Message[];
}

interface ChatContextType {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  status: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: ChatContextProps & { children: ReactNode }) {
  const { fileSystem, handleToolCall } = useFileSystem();

  const serializedFiles = useMemo(() => fileSystem.serialize(), [fileSystem]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
  } = useAIChat({
    api: "/api/chat",
    initialMessages,
    body: {
      files: serializedFiles,
      projectId,
    },
    onToolCall: ({ toolCall }) => {
      handleToolCall({
        toolName: toolCall.toolName,
        args: toolCall.args as Record<string, unknown>,
      });
    },
  });

  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages, serializedFiles);
    }
  }, [messages, serializedFiles, projectId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        handleInputChange,
        handleSubmit,
        status,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}