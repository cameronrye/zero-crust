/**
 * Logger Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Logger, { createLogger, rootLogger } from './Logger';

describe('Logger', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      const logger = new Logger('Test');
      logger.debug('debug message');

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.debug.mock.calls[0][0] as string);
      expect(output.level).toBe('debug');
      expect(output.message).toBe('debug message');
      expect(output.context).toBe('Test');
    });

    it('should log info messages', () => {
      const logger = new Logger('Test');
      logger.info('info message');

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(output.level).toBe('info');
      expect(output.message).toBe('info message');
    });

    it('should log warn messages', () => {
      const logger = new Logger('Test');
      logger.warn('warn message');

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string);
      expect(output.level).toBe('warn');
    });

    it('should log error messages', () => {
      const logger = new Logger('Test');
      logger.error('error message');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.error.mock.calls[0][0] as string);
      expect(output.level).toBe('error');
    });
  });

  describe('log filtering by minimum level', () => {
    it('should filter debug messages when minLevel is info', () => {
      const logger = new Logger('Test', 'info');
      logger.debug('should not appear');
      logger.info('should appear');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
    });

    it('should filter debug and info when minLevel is warn', () => {
      const logger = new Logger('Test', 'warn');
      logger.debug('nope');
      logger.info('nope');
      logger.warn('yes');
      logger.error('yes');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('data attachment', () => {
    it('should include data object in log output', () => {
      const logger = new Logger('Test');
      const data = { userId: 123, action: 'login' };
      logger.info('user action', data);

      const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(output.data).toEqual(data);
    });
  });

  describe('child logger', () => {
    it('should create child logger with combined context', () => {
      const parent = new Logger('Parent');
      const child = parent.child('Child');
      child.info('from child');

      const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(output.context).toBe('Parent:Child');
    });
  });

  describe('timestamp', () => {
    it('should include ISO timestamp in output', () => {
      const logger = new Logger('Test');
      logger.info('test');

      const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(output.timestamp).toBeDefined();
      expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
    });
  });

  describe('factory functions', () => {
    it('rootLogger should have ZeroCrust context', () => {
      rootLogger.info('root test');

      const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(output.context).toBe('ZeroCrust');
    });

    it('createLogger should create child of root', () => {
      const logger = createLogger('MyModule');
      logger.info('module test');

      const output = JSON.parse(consoleSpy.info.mock.calls[0][0] as string);
      expect(output.context).toBe('ZeroCrust:MyModule');
    });
  });
});

