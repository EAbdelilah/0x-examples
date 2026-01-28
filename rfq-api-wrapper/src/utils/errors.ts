export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class ExternalApiError extends AppError {
  constructor(message: string, statusCode: number = 502) {
    super(message, statusCode, 'EXTERNAL_API_ERROR');
  }
}
