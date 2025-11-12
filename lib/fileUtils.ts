// File utility functions (migrated from alpha/utils/fileUtils.ts)

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const dataUrlToBase64 = (dataUrl: string): string => {
    return dataUrl.split(',')[1];
};

// Validate file size
export const isValidFileSize = (file: File, maxSize: number): boolean => {
    return file.size <= maxSize;
};

// Validate file type
export const isValidFileType = (file: File, allowedTypes: string[]): boolean => {
    return allowedTypes.includes(file.type);
};
