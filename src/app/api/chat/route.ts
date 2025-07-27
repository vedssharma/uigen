import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText, appendResponseMessages } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().max(50000), // Limit message content to 50KB
  id: z.string().optional(),
  createdAt: z.date().optional(),
});

const FileNodeSchema = z.object({
  type: z.enum(["file", "directory"]),
  name: z.string().min(1).max(255).refine(
    (name) => name === "/" || /^[^<>:"/\\|?*\x00-\x1f]+$/.test(name),
    { message: "Invalid file name" }
  ),
  path: z.string().min(1).max(1000).regex(/^\/[^<>:"|?*\x00-\x1f]*$/), // Sanitize paths
  content: z.string().max(1024 * 1024).optional(), // Limit file size to 1MB
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(100), // Limit conversation length
  files: z.record(z.string(), FileNodeSchema).refine(
    (files) => Object.keys(files).length <= 50, // Limit number of files
    { message: "Too many files" }
  ),
  projectId: z.string().optional().refine(
    (val) => !val || val === "" || z.string().uuid().safeParse(val).success,
    { message: "Must be a valid UUID or empty string" }
  ),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Received request body:", JSON.stringify(body, null, 2));
    const { messages, files, projectId } = ChatRequestSchema.parse(body);

    messages.unshift({
      role: "system",
      content: generationPrompt,
    } as any);

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
        if (!projectId || projectId === "") return;
        
        try {
          const session = await getSession();
          if (!session) {
            console.error("User not authenticated, cannot save project");
            return;
          }

          const responseMessages = response.messages || [];
          const allMessages = appendResponseMessages({
            messages: [...messages.filter((m: any) => m.role !== "system")] as any,
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.errors);
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: error.errors,
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

export const maxDuration = 120;
