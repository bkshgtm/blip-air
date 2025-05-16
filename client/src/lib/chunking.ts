export function splitFileIntoChunks(file: File, chunkSize: number): Blob[] {
  const chunks: Blob[] = []
  let start = 0

  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size)
    chunks.push(file.slice(start, end))
    start = end
  }

  return chunks
}

export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(blob)
  })
}

export function arrayBufferToBlob(buffer: ArrayBuffer, type: string): Blob {
  return new Blob([buffer], { type })
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return "0 B/s"

  const k = 1024
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"]
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))

  return Number.parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "calculating..."
  if (seconds === 0) return "0s"

  if (seconds > 86400) {
    return "over 24h"
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

/**
 * Calculate accurate
 * @param received
 * @param total
 * @returns
 */
export function calculateProgress(received: number, total: number): number {
  if (!isFinite(received) || !isFinite(total) || total <= 0) {
    return 0
  }

  const progress = received / total
  return Math.max(0, Math.min(1, progress))
}

export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
