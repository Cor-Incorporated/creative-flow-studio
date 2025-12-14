export function safeErrorForLog(error: any): { name?: string; code?: string; message?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(Object.prototype.hasOwnProperty.call(error, 'code') ? { code: (error as any).code } : {}),
    };
  }
  return {
    message: String(error),
  };
}
