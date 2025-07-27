"use client";

import { useEffect, useRef } from "react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/lib/contexts/chat-context";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

export function ChatInterface() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { messages, input, handleInputChange, handleSubmit, status } = useChat();

  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement;
    
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  return (
    <ErrorBoundary
      fallback={(error) => (
        <div className="error-boundary bg-red-50 border border-red-200 rounded-lg p-4 m-4">
          <h2 className="text-red-800 font-semibold mb-2">Chat Error</h2>
          <p className="text-red-600 text-sm mb-3">
            Something went wrong with the chat interface. Please refresh the page to continue.
          </p>
          <details className="text-red-600 text-sm">
            <summary className="cursor-pointer">Technical details</summary>
            <pre className="mt-2 text-xs overflow-auto bg-red-100 p-2 rounded">
              {error.message}
            </pre>
          </details>
        </div>
      )}
    >
      <div className="flex flex-col h-full p-4 overflow-hidden">
        <ErrorBoundary>
          <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-hidden">
            <div className="pr-4">
              <MessageList messages={messages} isLoading={status === "streaming"} />
            </div>
          </ScrollArea>
        </ErrorBoundary>
        <ErrorBoundary>
          <div className="mt-4 flex-shrink-0">
            <MessageInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={status === "submitted" || status === "streaming"}
              disabled={status === "streaming"}
            />
          </div>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
