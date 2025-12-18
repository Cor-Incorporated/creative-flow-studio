export function safeErrorForLog(error: any): { name?: string; code?: string; message?: string } {
  if (!error) {
    return { message: 'Unknown error' };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(Object.prototype.hasOwnProperty.call(error, 'code') ? { code: (error as any).code } : {}),
    };
  }
  try {
    return {
      message: String(error),
    };
  } catch {
    return {
      message: 'Unknown error (failed to stringify)',
    };
  }
}
