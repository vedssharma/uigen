"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { VirtualFileSystem, FileNode } from "@/lib/file-system";
import { useFileSystemReducer } from "@/lib/hooks/useFileSystemReducer";

interface StrReplaceEditorArgs {
  command?: "create" | "str_replace" | "insert";
  path?: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
}

interface FileManagerArgs {
  command?: "rename" | "delete";
  path?: string;
  new_path?: string;
}

interface ToolCall {
  toolName: string;
  args: StrReplaceEditorArgs | FileManagerArgs | Record<string, unknown>;
}

interface FileSystemContextType {
  fileSystem: VirtualFileSystem;
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  createFile: (path: string, content?: string) => void;
  updateFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => boolean;
  getFileContent: (path: string) => string | null;
  getAllFiles: () => Map<string, string>;
  refreshTrigger: number;
  handleToolCall: (toolCall: ToolCall) => void;
  reset: () => void;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(
  undefined
);

export function FileSystemProvider({
  children,
  fileSystem: providedFileSystem,
  initialData,
}: {
  children: React.ReactNode;
  fileSystem?: VirtualFileSystem;
  initialData?: Record<string, FileNode>;
}) {
  const fileSystem = useMemo(() => {
    const fs = providedFileSystem || new VirtualFileSystem();
    if (initialData) {
      fs.deserializeFromNodes(initialData);
    }
    return fs;
  }, [providedFileSystem, initialData]);

  const { selectedFile, refreshTrigger, setSelectedFile, triggerRefresh, reset: resetState } = useFileSystemReducer();

  const autoSelectFile = useCallback(() => {
    if (selectedFile) return;
    
    const files = fileSystem.getAllFiles();
    
    if (files.has("/App.jsx")) {
      setSelectedFile("/App.jsx");
      return;
    }
    
    const rootFiles = Array.from(files.keys())
      .filter((path) => !path.includes("/", 1))
      .sort();
    
    if (rootFiles.length > 0) {
      setSelectedFile(rootFiles[0]);
    }
  }, [selectedFile, fileSystem, setSelectedFile]);

  useEffect(() => {
    autoSelectFile();
  }, [autoSelectFile, refreshTrigger]);

  const createFile = useCallback(
    (path: string, content = "") => {
      const success = fileSystem.createFile(path, content);
      if (success) {
        triggerRefresh();
      }
      return success;
    },
    [fileSystem, triggerRefresh]
  );

  const updateFile = useCallback(
    (path: string, content: string) => {
      const success = fileSystem.updateFile(path, content);
      if (success) {
        triggerRefresh();
      }
      return success;
    },
    [fileSystem, triggerRefresh]
  );

  const deleteFile = useCallback(
    (path: string) => {
      const success = fileSystem.deleteFile(path);
      if (success) {
        if (selectedFile === path || (selectedFile && selectedFile.startsWith(path + "/"))) {
          setSelectedFile(null);
        }
        triggerRefresh();
      }
      return success;
    },
    [fileSystem, selectedFile, triggerRefresh, setSelectedFile]
  );

  const renameFile = useCallback(
    (oldPath: string, newPath: string): boolean => {
      const success = fileSystem.rename(oldPath, newPath);
      if (success) {
        // Update selected file if it was renamed
        if (selectedFile === oldPath) {
          setSelectedFile(newPath);
        } else if (selectedFile && selectedFile.startsWith(oldPath + "/")) {
          // Update selected file if it's inside a renamed directory
          const relativePath = selectedFile.substring(oldPath.length);
          setSelectedFile(newPath + relativePath);
        }
        triggerRefresh();
      }
      return success;
    },
    [fileSystem, selectedFile, triggerRefresh, setSelectedFile]
  );

  const getFileContent = useCallback(
    (path: string) => {
      return fileSystem.readFile(path);
    },
    [fileSystem]
  );

  const getAllFiles = useCallback(() => {
    return fileSystem.getAllFiles();
  }, [fileSystem]);

  const reset = useCallback(() => {
    fileSystem.reset();
    resetState();
  }, [fileSystem, resetState]);

  const handleToolCall = useCallback(
    (toolCall: ToolCall) => {
      const { toolName, args } = toolCall;

      // Handle str_replace_editor tool
      if (toolName === "str_replace_editor" && args) {
        const strArgs = args as StrReplaceEditorArgs;
        const { command, path, file_text, old_str, new_str, insert_line } = strArgs;

        switch (command) {
          case "create":
            if (path && file_text !== undefined) {
              const result = fileSystem.createFileWithParents(path, file_text);
              if (!result.startsWith("Error:")) {
                triggerRefresh();
              }
            }
            break;

          case "str_replace":
            if (path && old_str !== undefined && new_str !== undefined) {
              const result = fileSystem.replaceInFile(path, old_str, new_str);
              if (!result.startsWith("Error:")) {
                triggerRefresh();
              }
            }
            break;

          case "insert":
            if (path && new_str !== undefined && insert_line !== undefined) {
              const result = fileSystem.insertInFile(path, insert_line, new_str);
              if (!result.startsWith("Error:")) {
                triggerRefresh();
              }
            }
            break;
        }
      }

      // Handle file_manager tool
      if (toolName === "file_manager" && args) {
        const fileArgs = args as FileManagerArgs;
        const { command, path, new_path } = fileArgs;

        switch (command) {
          case "rename":
            if (path && new_path) {
              renameFile(path, new_path);
            }
            break;

          case "delete":
            if (path) {
              const success = fileSystem.deleteFile(path);
              if (success) {
                if (selectedFile === path || (selectedFile && selectedFile.startsWith(path + "/"))) {
                  setSelectedFile(null);
                }
                triggerRefresh();
              }
            }
            break;
        }
      }
    },
    [fileSystem, renameFile, selectedFile, triggerRefresh, setSelectedFile]
  );

  return (
    <FileSystemContext.Provider
      value={{
        fileSystem,
        selectedFile,
        setSelectedFile,
        createFile,
        updateFile,
        deleteFile,
        renameFile,
        getFileContent,
        getAllFiles,
        refreshTrigger,
        handleToolCall,
        reset,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
}

export function useFileSystem() {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error("useFileSystem must be used within a FileSystemProvider");
  }
  return context;
}
