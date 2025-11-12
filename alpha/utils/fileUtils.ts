export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// Fix: Renamed function for clarity and to follow standard conventions.
export const dataUrlToBase64 = (dataUrl: string): string => {
    return dataUrl.split(',')[1];
};
