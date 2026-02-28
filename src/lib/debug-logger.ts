type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const COLORS: Record<LogLevel, string> = {
  DEBUG: 'color: #888',
  INFO: 'color: #4fc3f7',
  WARN: 'color: #ffb74d',
  ERROR: 'color: #ef5350; font-weight: bold',
};

const ENABLED = process.env.NODE_ENV === 'development';

function log(level: LogLevel, tag: string, message: string, data?: unknown) {
  if (!ENABLED) return;
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `%c[${ts}] [${level}] [${tag}]`;
  if (data !== undefined) {
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](prefix, COLORS[level], message, data);
  } else {
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](prefix, COLORS[level], message);
  }
}

export const dbg = {
  debug: (tag: string, msg: string, data?: unknown) => log('DEBUG', tag, msg, data),
  info: (tag: string, msg: string, data?: unknown) => log('INFO', tag, msg, data),
  warn: (tag: string, msg: string, data?: unknown) => log('WARN', tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => log('ERROR', tag, msg, data),
};
