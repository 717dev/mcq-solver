import { MAX_IMAGE_SIZE_BYTES } from './imageUtils';

export interface ValidatedImagePayload {
  base64Data: string;
  mimeType: string;
}

export function validateImagePayload(payload: unknown): {
  valid: true;
  data: ValidatedImagePayload;
} | {
  valid: false;
  error: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid request body format.' };
  }

  const { image } = payload as { image?: unknown };

  if (!image || typeof image !== 'string') {
    return { valid: false, error: 'No image data provided. Please capture or upload an image.' };
  }

  // Expect base64 data URL e.g. "data:image/jpeg;base64,..."
  const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);

  if (!match) {
    return {
      valid: false,
      error: 'Invalid image format. Must be a JPEG, PNG, or WebP base64 data URI.',
    };
  }

  const mimeType = match[1];
  const base64Data = match[2];

  // Rough estimation of base64 decoded size in bytes: (length * 3 / 4)
  const estimatedSizeBytes = (base64Data.length * 3) / 4;
  if (estimatedSizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Image file size exceeds the 5MB limit. Please capture a smaller image.',
    };
  }

  return {
    valid: true,
    data: {
      base64Data,
      mimeType,
    },
  };
}
