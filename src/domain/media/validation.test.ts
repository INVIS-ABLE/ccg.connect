import { describe, it, expect } from 'vitest';
import { classifyMedia, validateUpload } from './validation';

describe('classifyMedia', () => {
  it('classifies images, video and pdf', () => {
    expect(classifyMedia('image/jpeg')).toBe('image');
    expect(classifyMedia('video/mp4')).toBe('video');
    expect(classifyMedia('application/pdf')).toBe('document');
  });
  it('ignores charset params and casing', () => {
    expect(classifyMedia('IMAGE/PNG; charset=binary')).toBe('image');
  });
  it('rejects unknown types', () => {
    expect(classifyMedia('application/x-msdownload')).toBeNull();
    expect(classifyMedia('text/html')).toBeNull();
  });
});

describe('validateUpload', () => {
  it('accepts a normal image', () => {
    expect(validateUpload('image/jpeg', 2 * 1024 * 1024)).toEqual({ ok: true, mediaType: 'image' });
  });
  it('rejects an unsupported type', () => {
    expect(validateUpload('text/html', 100)).toEqual({ ok: false, reason: 'unsupported_type' });
  });
  it('rejects an empty file', () => {
    expect(validateUpload('image/png', 0)).toEqual({ ok: false, reason: 'empty_file' });
  });
  it('rejects an oversized image (>15MB)', () => {
    expect(validateUpload('image/png', 16 * 1024 * 1024)).toEqual({ ok: false, reason: 'too_large' });
  });
  it('allows a large video under the 200MB cap', () => {
    expect(validateUpload('video/mp4', 150 * 1024 * 1024)).toEqual({ ok: true, mediaType: 'video' });
  });
  it('caps documents at 25MB', () => {
    expect(validateUpload('application/pdf', 30 * 1024 * 1024)).toEqual({ ok: false, reason: 'too_large' });
  });
});
