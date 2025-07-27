"use client";

import { useEffect, useRef, useCallback, useMemo, useDeferredValue, useState } from "react";
import Editor from "@monaco-editor/react";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { Code2 } from "lucide-react";
import { debounce } from "@/lib/utils/debounce";

export function CodeEditor() {
  const { selectedFile, getFileContent, updateFile } = useFileSystem();
  const editorRef = useRef<any>(null);
  const [localContent, setLocalContent] = useState<string>("");

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
  };

  // Debounced update function
  const debouncedUpdate = useMemo(
    () => debounce((path: string, content: string) => {
      updateFile(path, content);
    }, 300),
    [updateFile]
  );

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (selectedFile && value !== undefined) {
      setLocalContent(value);
      debouncedUpdate(selectedFile, value);
    }
  }, [selectedFile, debouncedUpdate]);

  // Update local content when file changes
  useEffect(() => {
    if (selectedFile) {
      const fileContent = getFileContent(selectedFile) ?? '';
      setLocalContent(fileContent);
    }
  }, [selectedFile, getFileContent]);

  // Cleanup debounced function when component unmounts
  useEffect(() => {
    return () => {
      // The debounced function will be cleaned up automatically when the component unmounts
      // because the timeout will be cleared when the component is destroyed
    };
  }, []);

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

  const content = selectedFile ? localContent : '';
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