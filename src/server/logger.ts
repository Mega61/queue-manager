/** Tiny dependency-free structured logger (text or single-line JSON). */

import { config } from './config';

type Level = 'error' | 'warn' | 'info' | 'debug';
const LEVELS: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[(config.logLevel as Level)] ?? LEVELS.info;

type Fields = Record<string, unknown>;

function fmt(v: unknown): string {
  if (v == null) return String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return /\s/.test(s) ? JSON.stringify(s) : s;
}

function emit(level: Level, scope: string, message: string, fields?: Fields) {
  if (LEVELS[level] > threshold) return;
  const time = new Date().toISOString();
  if (config.logJson) {
    process.stdout.write(JSON.stringify({ time, level, scope, msg: message, ...fields }) + '\n');
    return;
  }
  const extra = fields && Object.keys(fields).length
    ? ' ' + Object.entries(fields).map(([k, v]) => `${k}=${fmt(v)}`).join(' ')
    : '';
  const line = `${time} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}${extra}\n`;
  if (level === 'error') process.stderr.write(line);
  else process.stdout.write(line);
}

export function createLogger(scope: string) {
  return {
    error: (msg: string, fields?: Fields) => emit('error', scope, msg, fields),
    warn: (msg: string, fields?: Fields) => emit('warn', scope, msg, fields),
    info: (msg: string, fields?: Fields) => emit('info', scope, msg, fields),
    debug: (msg: string, fields?: Fields) => emit('debug', scope, msg, fields),
  };
}

export type Logger = ReturnType<typeof createLogger>;
