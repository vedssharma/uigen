export interface FileNode {
  type: "file" | "directory";
  name: string;
  path: string;
  content?: string;
  children?: Map<string, FileNode>;
}

export interface SerializedFileNode {
  type: "file" | "directory";
  name: string;
  path: string;
  content?: string;
}

const ROOT_PATH = "/";
const PATH_SEPARATOR = "/";
const DEFAULT_FILE_CONTENT = "";
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.html', '.md', '.txt'];

export class VirtualFileSystem {
  private files: Map<string, FileNode> = new Map();
  private root: FileNode;
  private serializedCache: string | null = null;
  private cacheVersion = 0;

  constructor() {
    this.root = {
      type: "directory",
      name: "/",
      path: "/",
      children: new Map(),
    };
    this.files.set("/", this.root);
  }

  private sanitizePath(path: string): string {
    // Prevent directory traversal attacks
    const normalized = this.normalizePath(path);
    if (normalized.includes('..') || normalized.includes('~')) {
      throw new Error('Invalid path: directory traversal not allowed');
    }
    
    // Check for null bytes and other dangerous characters
    if (/[\x00-\x1f<>:"|?*]/.test(normalized)) {
      throw new Error('Invalid path: contains illegal characters');
    }
    
    // Ensure path length is reasonable
    if (normalized.length > 1000) {
      throw new Error('Invalid path: path too long');
    }
    
    return normalized;
  }

  private isFilePath(path: string): boolean {
    // Consider a path a file if it has an extension
    return path.includes('.') && !path.endsWith('/');
  }

  private validateFileContent(path: string, content: string): void {
    // Only validate if there's actually an extension
    if (path.includes('.')) {
      const extension = path.toLowerCase().substring(path.lastIndexOf('.'));
      if (extension && !ALLOWED_EXTENSIONS.includes(extension)) {
        throw new Error(`File type not allowed: ${extension}`);
      }
    }
    
    // Check file size
    if (content.length > MAX_FILE_SIZE) {
      throw new Error('File size exceeds maximum allowed size (1MB)');
    }
    
    // Check for dangerous content patterns (basic script injection prevention)
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(content)) {
      throw new Error('File content contains potentially dangerous scripts');
    }
  }

  private normalizePath(path: string): string {
    if (!path.startsWith(PATH_SEPARATOR)) {
      path = PATH_SEPARATOR + path;
    }
    if (path !== ROOT_PATH && path.endsWith(PATH_SEPARATOR)) {
      path = path.slice(0, -1);
    }
    return path.replace(/\/+/g, PATH_SEPARATOR);
  }

  private getParentPath(path: string): string {
    const normalized = this.normalizePath(path);
    if (normalized === ROOT_PATH) return ROOT_PATH;
    const lastSlashIndex = normalized.lastIndexOf(PATH_SEPARATOR);
    return lastSlashIndex <= 0 ? ROOT_PATH : normalized.substring(0, lastSlashIndex);
  }

  private getFileName(path: string): string {
    const normalized = this.normalizePath(path);
    if (normalized === ROOT_PATH) return ROOT_PATH;
    const lastSlashIndex = normalized.lastIndexOf(PATH_SEPARATOR);
    return lastSlashIndex === -1 ? normalized : normalized.substring(lastSlashIndex + 1);
  }

  private getParentNode(path: string): FileNode | null {
    const parentPath = this.getParentPath(path);
    return this.files.get(parentPath) || null;
  }

  createFile(path: string, content: string = DEFAULT_FILE_CONTENT): FileNode | null {
    const normalized = this.sanitizePath(path);
    // Only validate content for actual files, not directory tests
    if (content !== DEFAULT_FILE_CONTENT || this.isFilePath(normalized)) {
      this.validateFileContent(normalized, content);
    }

    // Check if file already exists
    if (this.files.has(normalized)) {
      return null;
    }

    // Create parent directories if they don't exist
    const parts = normalized.split("/").filter(Boolean);
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += "/" + parts[i];
      if (!this.exists(currentPath)) {
        this.createDirectory(currentPath);
      }
    }

    const parent = this.getParentNode(normalized);
    if (!parent || parent.type !== "directory") {
      return null;
    }

    const fileName = this.getFileName(normalized);
    const file: FileNode = {
      type: "file",
      name: fileName,
      path: normalized,
      content,
    };

    this.files.set(normalized, file);
    parent.children!.set(fileName, file);
    this.invalidateCache();

    return file;
  }

  createDirectory(path: string): FileNode | null {
    const normalized = this.sanitizePath(path);

    // Check if directory already exists
    if (this.files.has(normalized)) {
      return null;
    }

    const parent = this.getParentNode(normalized);
    if (!parent || parent.type !== "directory") {
      return null;
    }

    const dirName = this.getFileName(normalized);
    const directory: FileNode = {
      type: "directory",
      name: dirName,
      path: normalized,
      children: new Map(),
    };

    this.files.set(normalized, directory);
    parent.children!.set(dirName, directory);
    this.invalidateCache();

    return directory;
  }

  readFile(path: string): string | null {
    const normalized = this.sanitizePath(path);
    const file = this.files.get(normalized);

    if (!file || file.type !== "file") {
      return null;
    }

    return file.content ?? DEFAULT_FILE_CONTENT;
  }

  updateFile(path: string, content: string): boolean {
    const normalized = this.sanitizePath(path);
    const file = this.files.get(normalized);

    if (!file || file.type !== "file") {
      return false;
    }

    // Only validate content for actual file updates
    this.validateFileContent(normalized, content);
    file.content = content;
    this.invalidateCache();
    return true;
  }

  deleteFile(path: string): boolean {
    const normalized = this.sanitizePath(path);
    const file = this.files.get(normalized);

    if (!file || normalized === "/") {
      return false;
    }

    const parent = this.getParentNode(normalized);
    if (!parent || parent.type !== "directory") {
      return false;
    }

    // If it's a directory, remove all children recursively
    if (file.type === "directory" && file.children) {
      for (const [_, child] of file.children) {
        this.deleteFile(child.path);
      }
    }

    parent.children!.delete(file.name);
    this.files.delete(normalized);
    this.invalidateCache();

    return true;
  }

  rename(oldPath: string, newPath: string): boolean {
    const normalizedOld = this.sanitizePath(oldPath);
    const normalizedNew = this.sanitizePath(newPath);

    // Can't rename root
    if (normalizedOld === "/" || normalizedNew === "/") {
      return false;
    }

    // Check if source exists
    const sourceNode = this.files.get(normalizedOld);
    if (!sourceNode) {
      return false;
    }

    // Check if destination already exists
    if (this.files.has(normalizedNew)) {
      return false;
    }

    // Get parent of source
    const oldParent = this.getParentNode(normalizedOld);
    if (!oldParent || oldParent.type !== "directory") {
      return false;
    }

    // Create parent directories for destination if needed
    const newParentPath = this.getParentPath(normalizedNew);
    if (!this.exists(newParentPath)) {
      const parts = newParentPath.split("/").filter(Boolean);
      let currentPath = "";

      for (const part of parts) {
        currentPath += "/" + part;
        if (!this.exists(currentPath)) {
          this.createDirectory(currentPath);
        }
      }
    }

    // Get parent of destination
    const newParent = this.getParentNode(normalizedNew);
    if (!newParent || newParent.type !== "directory") {
      return false;
    }

    // Remove from old parent
    oldParent.children!.delete(sourceNode.name);

    // Update the node's path and name
    const newName = this.getFileName(normalizedNew);
    sourceNode.name = newName;
    sourceNode.path = normalizedNew;

    // Add to new parent
    newParent.children!.set(newName, sourceNode);

    // Update in files map
    this.files.delete(normalizedOld);
    this.files.set(normalizedNew, sourceNode);

    // If it's a directory, update all children paths recursively
    if (sourceNode.type === "directory" && sourceNode.children) {
      this.updateChildrenPaths(sourceNode);
    }
    this.invalidateCache();

    return true;
  }

  private updateChildrenPaths(node: FileNode): void {
    if (node.type === "directory" && node.children) {
      for (const [_, child] of node.children) {
        const oldChildPath = child.path;
        child.path = node.path + "/" + child.name;

        // Update in files map
        this.files.delete(oldChildPath);
        this.files.set(child.path, child);

        // Recursively update children if it's a directory
        if (child.type === "directory") {
          this.updateChildrenPaths(child);
        }
      }
    }
  }

  exists(path: string): boolean {
    const normalized = this.sanitizePath(path);
    return this.files.has(normalized);
  }

  getNode(path: string): FileNode | null {
    const normalized = this.sanitizePath(path);
    return this.files.get(normalized) || null;
  }

  listDirectory(path: string): FileNode[] | null {
    const normalized = this.sanitizePath(path);
    const dir = this.files.get(normalized);

    if (!dir || dir.type !== "directory") {
      return null;
    }

    return Array.from(dir.children?.values() || []);
  }

  getAllFiles(): Map<string, string> {
    const fileMap = new Map<string, string>();

    for (const [path, node] of this.files) {
      if (node.type === "file") {
        fileMap.set(path, node.content || "");
      }
    }

    return fileMap;
  }

  serialize(): Record<string, FileNode> {
    if (this.serializedCache && this.cacheVersion === this.files.size) {
      return JSON.parse(this.serializedCache);
    }
    
    const result = this.computeSerialize();
    this.serializedCache = JSON.stringify(result);
    this.cacheVersion = this.files.size;
    return result;
  }

  private computeSerialize(): Record<string, FileNode> {
    const result: Record<string, FileNode> = {};

    for (const [path, node] of this.files) {
      // Create a shallow copy without the Map children to avoid serialization issues
      if (node.type === "directory") {
        result[path] = {
          type: node.type,
          name: node.name,
          path: node.path,
        };
      } else {
        result[path] = {
          type: node.type,
          name: node.name,
          path: node.path,
          content: node.content,
        };
      }
    }

    return result;
  }

  private invalidateCache(): void {
    this.serializedCache = null;
  }

  deserialize(data: Record<string, string>): void {
    // Clear existing files except root
    this.files.clear();
    this.root.children?.clear();
    this.files.set("/", this.root);

    // Sort paths to ensure parent directories are created first
    const paths = Object.keys(data).sort();

    for (const path of paths) {
      const parts = path.split("/").filter(Boolean);
      let currentPath = "";

      // Create parent directories if they don't exist
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += "/" + parts[i];
        if (!this.exists(currentPath)) {
          this.createDirectory(currentPath);
        }
      }

      // Create the file
      this.createFile(path, data[path]);
    }
  }

  deserializeFromNodes(data: Record<string, FileNode>): void {
    // Clear existing files except root
    this.files.clear();
    this.root.children?.clear();
    this.files.set("/", this.root);

    // Sort paths to ensure parent directories are created first
    const paths = Object.keys(data).sort();

    for (const path of paths) {
      if (path === "/") continue; // Skip root

      const node = data[path];
      const parts = path.split("/").filter(Boolean);
      let currentPath = "";

      // Create parent directories if they don't exist
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += "/" + parts[i];
        if (!this.exists(currentPath)) {
          this.createDirectory(currentPath);
        }
      }

      // Create the file or directory
      if (node.type === "file") {
        this.createFile(path, node.content || "");
      } else if (node.type === "directory") {
        this.createDirectory(path);
      }
    }
  }

  // Text editor command implementations
  viewFile(path: string, viewRange?: [number, number]): string {
    const file = this.getNode(path);
    if (!file) {
      return `File not found: ${path}`;
    }

    // If it's a directory, list its contents
    if (file.type === "directory") {
      const children = this.listDirectory(path);
      if (!children || children.length === 0) {
        return "(empty directory)";
      }

      return children
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => {
          const prefix = child.type === "directory" ? "[DIR]" : "[FILE]";
          return `${prefix} ${child.name}`;
        })
        .join("\n");
    }

    // For files, show content
    const content = file.content || "";

    // Handle view_range if provided
    if (viewRange && viewRange.length === 2) {
      const lines = content.split("\n");
      const [start, end] = viewRange;
      const startLine = Math.max(1, start);
      const endLine = end === -1 ? lines.length : Math.min(lines.length, end);

      const viewedLines = lines.slice(startLine - 1, endLine);
      return viewedLines
        .map((line, index) => `${startLine + index}\t${line}`)
        .join("\n");
    }

    // Return full file with line numbers
    const lines = content.split("\n");
    return (
      lines.map((line, index) => `${index + 1}\t${line}`).join("\n") ||
      "(empty file)"
    );
  }

  createFileWithParents(path: string, content: string = DEFAULT_FILE_CONTENT): string {
    // Check if file already exists
    if (this.exists(path)) {
      return `Error: File already exists: ${path}`;
    }

    // Create parent directories if they don't exist
    const parts = path.split("/").filter(Boolean);
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += "/" + parts[i];
      if (!this.exists(currentPath)) {
        this.createDirectory(currentPath);
      }
    }

    // Create the file
    this.createFile(path, content);
    return `File created: ${path}`;
  }

  replaceInFile(path: string, oldStr: string, newStr: string): string {
    const file = this.getNode(path);
    if (!file) {
      return `Error: File not found: ${path}`;
    }

    if (file.type !== "file") {
      return `Error: Cannot edit a directory: ${path}`;
    }

    const content = this.readFile(path) || "";

    // Check if old_str exists in the file
    if (!oldStr || !content.includes(oldStr)) {
      return `Error: String not found in file: "${oldStr}"`;
    }

    // Count occurrences
    const occurrences = (
      content.match(
        new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
      ) || []
    ).length;

    // Replace all occurrences
    const updatedContent = content.split(oldStr).join(newStr ?? DEFAULT_FILE_CONTENT);
    this.updateFile(path, updatedContent);

    return `Replaced ${occurrences} occurrence(s) of the string in ${path}`;
  }

  insertInFile(path: string, insertLine: number, text: string): string {
    const file = this.getNode(path);
    if (!file) {
      return `Error: File not found: ${path}`;
    }

    if (file.type !== "file") {
      return `Error: Cannot edit a directory: ${path}`;
    }

    const content = this.readFile(path) || "";
    const lines = content.split("\n");

    // Validate insert_line
    if (
      insertLine === undefined ||
      insertLine < 0 ||
      insertLine > lines.length
    ) {
      return `Error: Invalid line number: ${insertLine}. File has ${lines.length} lines.`;
    }

    // Insert the text
    lines.splice(insertLine, 0, text ?? DEFAULT_FILE_CONTENT);
    const updatedContent = lines.join("\n");
    this.updateFile(path, updatedContent);

    return `Text inserted at line ${insertLine} in ${path}`;
  }

  reset(): void {
    // Clear all files and reset to initial state
    this.files.clear();
    this.root = {
      type: "directory",
      name: "/",
      path: "/",
      children: new Map(),
    };
    this.files.set("/", this.root);
    this.invalidateCache();
  }
}

export const fileSystem = new VirtualFileSystem();
