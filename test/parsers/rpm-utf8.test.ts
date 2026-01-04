import { describe, it, expect } from 'vitest';
import { parseStringArray } from '../../src/parsers/rpm';

// ============================================================================
// RPM STRING_ARRAY UTF-8 Parsing Tests
//
// Tests for correct UTF-8 byte length handling in STRING_ARRAY parsing.
// This verifies the fix for the bug where multi-byte UTF-8 characters
// (e.g., Japanese, Chinese, emojis) would cause string extraction to fail
// because the parser was advancing by JavaScript string length instead of
// actual byte length.
// ============================================================================

describe('parseStringArray UTF-8 handling', () => {
  // Helper to create a null-terminated string array buffer
  function createStringArrayBuffer(strings: string[]): Uint8Array {
    const encoder = new TextEncoder();
    const encoded = strings.map(s => encoder.encode(s));
    const totalSize = encoded.reduce((sum, arr) => sum + arr.length + 1, 0);
    const buffer = new Uint8Array(totalSize);

    let offset = 0;
    for (const arr of encoded) {
      buffer.set(arr, offset);
      offset += arr.length;
      buffer[offset] = 0; // null terminator
      offset++;
    }

    return buffer;
  }

  it('parses ASCII strings correctly', () => {
    const strings = ['hello', 'world', 'test'];
    const buffer = createStringArrayBuffer(strings);

    const result = parseStringArray(buffer, 0, 3);

    expect(result).toEqual(strings);
  });

  it('parses UTF-8 strings with multi-byte characters', () => {
    const strings = ['日本語', 'テスト', '测试'];
    const buffer = createStringArrayBuffer(strings);

    const result = parseStringArray(buffer, 0, 3);

    expect(result).toEqual(strings);
  });

  it('parses mixed ASCII and UTF-8 strings', () => {
    const strings = ['hello', '世界', 'test', 'こんにちは', 'end'];
    const buffer = createStringArrayBuffer(strings);

    const result = parseStringArray(buffer, 0, 5);

    expect(result).toEqual(strings);
  });

  it('handles emoji characters', () => {
    const strings = ['🚀', 'test', '👍👎', 'end'];
    const buffer = createStringArrayBuffer(strings);

    const result = parseStringArray(buffer, 0, 4);

    expect(result).toEqual(strings);
  });

  it('handles strings with varying UTF-8 byte lengths', () => {
    // Mix of 1-byte (ASCII), 2-byte (é), 3-byte (中), and 4-byte (🎉)
    const strings = ['a', 'é', '中', '🎉', 'end'];
    const buffer = createStringArrayBuffer(strings);

    const result = parseStringArray(buffer, 0, 5);

    expect(result).toEqual(strings);
  });

  it('parses single multi-byte string', () => {
    const strings = ['日本語テスト'];
    const buffer = createStringArrayBuffer(strings);

    const result = parseStringArray(buffer, 0, 1);

    expect(result).toEqual(strings);
  });

  it('handles empty strings in array', () => {
    const strings = ['', 'test', '', 'end', ''];
    const buffer = createStringArrayBuffer(strings);

    const result = parseStringArray(buffer, 0, 5);

    expect(result).toEqual(strings);
  });

  it('handles offset into buffer', () => {
    // Add some padding bytes before the actual strings
    const strings = ['hello', 'world'];
    const stringBuffer = createStringArrayBuffer(strings);
    const paddedBuffer = new Uint8Array(10 + stringBuffer.length);
    paddedBuffer.set(stringBuffer, 10);

    const result = parseStringArray(paddedBuffer, 10, 2);

    expect(result).toEqual(strings);
  });

  it('handles real-world RPM file paths', () => {
    const strings = [
      '/usr/bin/プログラム',
      '/usr/share/doc/パッケージ/README',
      '/etc/設定/config',
    ];
    const buffer = createStringArrayBuffer(strings);

    const result = parseStringArray(buffer, 0, 3);

    expect(result).toEqual(strings);
  });

  it('handles long UTF-8 strings', () => {
    const longString = '日本語'.repeat(100);
    const strings = [longString, 'end'];
    const buffer = createStringArrayBuffer(strings);

    const result = parseStringArray(buffer, 0, 2);

    expect(result).toEqual(strings);
  });

  it('parses zero strings', () => {
    const buffer = new Uint8Array([]);

    const result = parseStringArray(buffer, 0, 0);

    expect(result).toEqual([]);
  });
});
