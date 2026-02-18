import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  ForbiddenError,
  ConflictError,
  InternalError,
} from './errors';

describe('AppError', () => {
  it('sets all properties correctly', () => {
    const error = new AppError('test message', 400, 'TEST_ERROR', true);
    expect(error.message).toBe('test message');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.isOperational).toBe(true);
  });

  it('defaults isOperational to true', () => {
    const error = new AppError('test', 500, 'TEST');
    expect(error.isOperational).toBe(true);
  });

  it('is an instance of Error', () => {
    const error = new AppError('test', 500, 'TEST');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ValidationError', () => {
  it('has correct status code and code', () => {
    const error = new ValidationError('Bad input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Bad input');
  });

  it('stores issues property', () => {
    const issues = [{ path: ['email'], message: 'Invalid' }];
    const error = new ValidationError('Bad input', issues);
    expect(error.issues).toEqual(issues);
  });

  it('is operational', () => {
    const error = new ValidationError('Bad input');
    expect(error.isOperational).toBe(true);
  });
});

describe('NotFoundError', () => {
  it('includes resource name in message', () => {
    const error = new NotFoundError('User');
    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });
});

describe('AuthenticationError', () => {
  it('has default message', () => {
    const error = new AuthenticationError();
    expect(error.message).toBe('Unauthorized');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('accepts custom message', () => {
    const error = new AuthenticationError('Token expired');
    expect(error.message).toBe('Token expired');
  });
});

describe('ForbiddenError', () => {
  it('has default message', () => {
    const error = new ForbiddenError();
    expect(error.message).toBe('Forbidden');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });
});

describe('ConflictError', () => {
  it('has correct status code', () => {
    const error = new ConflictError('Already exists');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Already exists');
  });
});

describe('InternalError', () => {
  it('has default message and is NOT operational', () => {
    const error = new InternalError();
    expect(error.message).toBe('Internal server error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(false);
  });

  it('accepts custom message', () => {
    const error = new InternalError('DB connection failed');
    expect(error.message).toBe('DB connection failed');
    expect(error.isOperational).toBe(false);
  });
});
