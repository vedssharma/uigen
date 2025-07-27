"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import Editor from "@monaco-editor/react";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { Code2 } from "lucide-react";

export function CodeEditor() {
  const { selectedFile, getFileContent, updateFile } = useFileSystem();
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (selectedFile && value !== undefined) {
      updateFile(selectedFile, value);
    }
  }, [selectedFile, updateFile]);

  const getLanguageFromPath = useCallback((path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      css: 'css',
      html: 'html',
      md: 'markdown',
    };
    return languageMap[extension ?? ''] ?? 'plaintext';
  }, []);

  const content = useMemo(() => selectedFile ? (getFileContent(selectedFile) ?? '') : '', [getFileContent, selectedFile]);
  const language = useMemo(() => selectedFile ? getLanguageFromPath(selectedFile) : 'plaintext', [getLanguageFromPath, selectedFile]);
  const editorOptions = useMemo(() => ({
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on' as const,
    roundedSelection: false,
    scrollBeyondLastLine: false,
    readOnly: false,
    automaticLayout: true,
    wordWrap: 'on' as const,
    padding: { top: 16, bottom: 16 },
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: false,
  }), []);

  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Code2 className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Select a file to edit
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Choose a file from the file tree
          </p>
        </div>
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      theme="vs-dark"
      options={editorOptions}
    />
  );
}