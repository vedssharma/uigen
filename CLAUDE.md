# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. It's a Next.js 15 application that allows users to describe React components in chat and see them generated in real-time with a virtual file system.

## Commands

- `npm run setup` - Install dependencies, generate Prisma client, and run database migrations (run this first)
- `npm run dev` - Start development server with turbopack
- `npm run dev:daemon` - Start dev server in background, logging to logs.txt
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run tests with Vitest
- `npm run db:reset` - Reset database with Prisma

## Architecture

### Core System
- **Virtual File System**: `src/lib/file-system.ts` implements a complete in-memory file system that doesn't write to disk
- **Chat API**: `src/app/api/chat/route.ts` handles AI interactions using Anthropic Claude via Vercel AI SDK
- **Database**: Prisma with SQLite for user authentication and project persistence

### Context System
- **FileSystemContext**: `src/lib/contexts/file-system-context.tsx` manages virtual file operations and tool calls
- **ChatContext**: `src/lib/contexts/chat-context.tsx` handles AI chat interactions and integrates with file system

### AI Tools Integration
- **str_replace_editor**: Tool for creating/editing files in the virtual file system
- **file_manager**: Tool for file operations (rename, delete)
- Tools are handled via `handleToolCall` method in FileSystemContext

### Key Features
- Components are generated in a virtual file system (no disk writes)
- Real-time preview using Monaco Editor and live component rendering
- User authentication with bcrypt-hashed passwords
- Anonymous users can work without authentication (tracked via `anon-work-tracker`)
- Projects can be saved/loaded for authenticated users

### File Structure
- `/src/app/` - Next.js App Router pages and API routes
- `/src/components/` - React components (chat, editor, preview, auth, UI)
- `/src/lib/` - Core utilities (file system, contexts, tools, auth)
- `/prisma/` - Database schema and migrations

### Environment Variables
- `ANTHROPIC_API_KEY` (optional) - If not set, returns static code instead of AI-generated components

### Testing
Uses Vitest with Testing Library for component and utility testing. Test files are in `__tests__` directories alongside source files.

### Code Guidelines
- Only use comments to describe complex code. Don't use comments too much

### Development Guidance
- Use the schema defined in @prisma/schema.prisma in order to get an understanding of the data elements and how they are all structured in the application