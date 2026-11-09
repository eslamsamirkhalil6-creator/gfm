export function createHttpError(
  statusCode: number,
  code: string,
  message: string,
  details?: any
): Error {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  if (details !== undefined) {
    err.details = details;
  }
  return err;
}

export function badRequest(message: string, code: string = 'VALIDATION_ERROR', details?: any): Error {
  return createHttpError(400, code, message, details);
}

export function forbidden(message: string, code: string = 'FORBIDDEN', details?: any): Error {
  return createHttpError(403, code, message, details);
}

export function notFound(message: string, code: string = 'NOT_FOUND'): Error {
  return createHttpError(404, code, message);
}

export function conflict(message: string, code: string = 'CONFLICT', details?: any): Error {
  return createHttpError(409, code, message, details);
}

export function parsePositiveInt(value: any, fieldName: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw badRequest(`${fieldName} must be a positive integer`);
  }
  return num;
}

export function parsePositiveNumber(value: any, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw badRequest(`${fieldName} must be a positive number greater than 0`);
  }
  return roundQty(num);
}

export function parseNonNegativeNumber(value: any, fieldName: string, defaultValue?: number): number {
  if ((value === undefined || value === null || value === '') && defaultValue !== undefined) {
    return roundQty(defaultValue);
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw badRequest(`${fieldName} must be a non-negative number`);
  }
  return roundQty(num);
}

export function parseEnumValue<T extends string>(
  value: any,
  allowed: readonly T[],
  fieldName: string
): T {
  const str = String(value || '').trim();
  if (!allowed.includes(str as T)) {
    throw badRequest(`${fieldName} must be one of: ${allowed.join(', ')}`);
  }
  return str as T;
}

export function roundQty(val: number): number {
  return Math.round(val * 10000) / 10000;
}

let refSeq = 0;
export function generateDocRef(prefix: string): string {
  refSeq = (refSeq + 1) % 100000;
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 1679616)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  const seq = String(refSeq).padStart(5, '0');
  return `${prefix}-${ts}-${rnd}-${seq}`;
}
