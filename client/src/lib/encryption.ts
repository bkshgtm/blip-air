/**
 * Encryption utilities using Web Crypto API with AES-GCM
 */

// Generate a random encryption key
export async function generateKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  )
}

// Export a CryptoKey to raw bytes
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const rawKey = await window.crypto.subtle.exportKey("raw", key)
  return new Uint8Array(rawKey)
}

// Import raw bytes as a CryptoKey
export async function importKey(keyData: Uint8Array): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    "raw",
    keyData,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  )
}

// Generate a random initialization vector
export function generateIV(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12))
}

// Encrypt data using AES-GCM
export async function encryptData(data: Uint8Array): Promise<{
  encryptedData: Uint8Array
  key: Uint8Array
  iv: Uint8Array
}> {
  // Generate a new key and IV for each encryption
  const key = await generateKey()
  const iv = generateIV()

  // Encrypt the data
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    data,
  )

  // Export the key for transmission
  const exportedKey = await exportKey(key)

  return {
    encryptedData: new Uint8Array(encryptedBuffer),
    key: exportedKey,
    iv,
  }
}

// Decrypt data using AES-GCM
export async function decryptData(
  encryptedData: number[] | Uint8Array,
  keyData: number[] | Uint8Array,
  ivData: number[] | Uint8Array,
): Promise<Uint8Array> {
  // Convert arrays to Uint8Array if needed
  const encryptedArray = Array.isArray(encryptedData) ? new Uint8Array(encryptedData) : encryptedData

  const keyArray = Array.isArray(keyData) ? new Uint8Array(keyData) : keyData

  const ivArray = Array.isArray(ivData) ? new Uint8Array(ivData) : ivData

  // Import the key
  const key = await importKey(keyArray)

  // Decrypt the data
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivArray,
    },
    key,
    encryptedArray,
  )

  return new Uint8Array(decryptedBuffer)
}
