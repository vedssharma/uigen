import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText, appendResponseMessages } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";

interface ChatRequest {
  messages: any[];
  files: Record<string, FileNode>;
  projectId?: string;
}

export async function POST(req: Request) {
  const { messages, files, projectId }: ChatRequest = await req.json();

  messages.unshift({
    role: "system",
    content: generationPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  });

  const fileSystem = new VirtualFileSystem();
  if (files && Object.keys(files).length > 0) {
    fileSystem.deserializeFromNodes(files);
  }

  const model = getLanguageModel();
  const isMockProvider = !process.env.ANTHROPIC_API_KEY;
  const maxSteps = isMockProvider ? 4 : 40;
  const result = streamText({
    model,
    messages,
    maxTokens: 10_000,
    maxSteps,
    onError: (err: any) => {
      console.error(err);
    },
    tools: {
      str_replace_editor: buildStrReplaceTool(fileSystem),
      file_manager: buildFileManagerTool(fileSystem),
    },
    onFinish: async ({ response }) => {
      if (!projectId) return;
      
      try {
        const session = await getSession();
        if (!session) {
          console.error("User not authenticated, cannot save project");
          return;
        }

        const responseMessages = response.messages || [];
        const allMessages = appendResponseMessages({
          messages: [...messages.filter((m: any) => m.role !== "system")],
          responseMessages,
        });

        await prisma.project.update({
          where: {
            id: projectId,
            userId: session.userId,
          },
          data: {
            messages: JSON.stringify(allMessages),
            data: JSON.stringify(fileSystem.serialize()),
          },
        });
      } catch (error) {
        console.error("Failed to save project data:", error);
      }
    },
  });

  return result.toDataStreamResponse();
}

export const maxDuration = 120;
