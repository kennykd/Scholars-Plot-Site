import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

global.TextEncoder = global.TextEncoder ?? TextEncoder;
global.TextDecoder = global.TextDecoder ?? TextDecoder;

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = global.ResizeObserver ?? ResizeObserver;



