declare module 'expo-file-system' {
  export interface FileInfo {
    exists: boolean;
    uri: string;
    size?: number;
    isDirectory?: boolean;
    modificationTime?: number;
    md5?: string;
  }

  export interface FileSystemOptions {
    md5?: boolean;
    size?: boolean;
  }

  export const documentDirectory: string | null;
  export const cacheDirectory: string | null;
  export const bundleDirectory: string | null;
  
  export function getInfoAsync(fileUri: string, options?: FileSystemOptions): Promise<FileInfo>;
  export function readAsStringAsync(fileUri: string): Promise<string>;
  export function writeAsStringAsync(fileUri: string, contents: string, options?: {
    encoding?: 'utf8' | 'base64';
  }): Promise<void>;
  export function deleteAsync(fileUri: string, options?: {
    idempotent?: boolean;
  }): Promise<void>;
  export function makeDirectoryAsync(fileUri: string, options?: {
    intermediates?: boolean;
  }): Promise<void>;
  export function readDirectoryAsync(fileUri: string): Promise<string[]>;
}

