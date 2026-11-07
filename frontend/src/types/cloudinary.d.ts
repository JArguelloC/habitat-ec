export interface CloudinaryUploadWidgetInfo {
  secure_url: string;
  url: string;
  public_id: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  thumbnail_url?: string;
  resource_type?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface CloudinaryUploadWidgetResult {
  event: 'success' | 'close' | 'queues-start' | 'queues-end' | 'abort' | string;
  info?: CloudinaryUploadWidgetInfo;
}

export interface CloudinaryUploadWidgetInstance {
  open: () => void;
  close: () => void;
  destroy: () => void;
  isShowing: () => boolean;
}

export interface CloudinaryUploadWidgetOptions {
  cloudName: string;
  uploadPreset: string;
  multiple?: boolean;
  sources?: string[];
  resourceType?: string;
  folder?: string;
  clientAllowedFormats?: string[];
  maxFileSize?: number;
  language?: string;
  text?: Record<string, unknown>;
  [key: string]: unknown;
}

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: CloudinaryUploadWidgetOptions,
        callback: (error: unknown, result: CloudinaryUploadWidgetResult) => void,
      ) => CloudinaryUploadWidgetInstance;
    };
  }
}

