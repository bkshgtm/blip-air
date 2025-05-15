interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string
  readonly VITE_WS_URL?: string
  readonly MODE: "development" | "production" | "test"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface FileSystemHandle {
  kind: "file" | "directory"
  name: string
  isSameEntry(other: FileSystemHandle): Promise<boolean>
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: "file"
  getFile(): Promise<File>
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>
  seek(position: number): Promise<void>
  truncate(size: number): Promise<void>
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean
}

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite"
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{
    description?: string
    accept?: Record<string, string[]>
  }>
  excludeAcceptAllOption?: boolean
}

interface Window {
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}

interface OpenFilePickerOptions {}
interface DirectoryPickerOptions {}
interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: "directory"
}
