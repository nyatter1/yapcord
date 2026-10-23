/**
 * Cloudinary Upload Service
 * Handles uploading avatar and banner images to Cloudinary.
 */

const CLOUD_NAME = 'oc8buhae';
const UPLOAD_PRESET = 'yapcord';
const API_KEY = '368174262759735';

export async function uploadToCloudinary(fileOrDataUrl: string | File): Promise<string> {
  // If already a remote URL (e.g., from a previous Cloudinary upload or external link), return as is
  if (typeof fileOrDataUrl === 'string' && (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://'))) {
    return fileOrDataUrl;
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const formData = new FormData();

  formData.append('file', fileOrDataUrl);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('api_key', API_KEY);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Cloudinary upload warning:', errorData);
      // If upload preset requires signing or has specific configuration,
      // fallback to original string if it is a data URL so user doesn't lose image
      if (typeof fileOrDataUrl === 'string') {
        return fileOrDataUrl;
      }
      throw new Error(errorData.error?.message || 'Failed to upload image to Cloudinary');
    }

    const data = await response.json();
    return data.secure_url || data.url || (typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    // Return the data URL as fallback so the UI still displays the cropped image
    if (typeof fileOrDataUrl === 'string') {
      return fileOrDataUrl;
    }
    throw error;
  }
}
