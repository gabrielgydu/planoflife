import imageCompression from 'browser-image-compression'

const MAX_SIZE_KB = 200

export async function compressImage(file: File): Promise<string> {
  const options = {
    maxSizeMB: MAX_SIZE_KB / 1024,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
  }

  const compressedFile = await imageCompression(file, options)
  return fileToBase64(compressedFile)
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
