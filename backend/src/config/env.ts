import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

export interface EnvConfig {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  NODE_ENV: string;
  CORS_ORIGIN: string;
}

const KNOWN_INSECURE_SECRETS = new Set([
  'gfms-super-secret-jwt-key-2026-production-prototype',
  'changeme',
  'secret',
  'jwt-secret',
]);

function resolveJwtSecret(nodeEnv: string): string {
  const configured = (process.env.JWT_SECRET || '').trim();
  if (nodeEnv === 'production') {
    if (!configured || configured.length < 32 || KNOWN_INSECURE_SECRETS.has(configured)) {
      throw new Error(
        '[SECURITY ERROR] JWT_SECRET must be explicitly configured (>= 32 chars, non-default) when NODE_ENV=production.'
      );
    }
    return configured;
  }

  if (configured && !KNOWN_INSECURE_SECRETS.has(configured)) {
    return configured;
  }

  console.warn(
    '[SECURITY WARNING] JWT_SECRET is not set; using an ephemeral random secret for this development/test process.'
  );
  return crypto.randomBytes(32).toString('hex');
}

function resolveCorsOrigin(nodeEnv: string): string {
  const configured = (process.env.CORS_ORIGIN || '').trim();
  if (nodeEnv === 'production') {
    if (!configured || configured === '*') {
      throw new Error(
        '[SECURITY ERROR] CORS_ORIGIN must be explicitly set to allowed origin(s) (never "*") when NODE_ENV=production.'
      );
    }
    return configured;
  }

  return configured || 'http://localhost:3000,http://127.0.0.1:3000';
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const env: EnvConfig = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: resolveJwtSecret(nodeEnv),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  NODE_ENV: nodeEnv,
  CORS_ORIGIN: resolveCorsOrigin(nodeEnv),
};

