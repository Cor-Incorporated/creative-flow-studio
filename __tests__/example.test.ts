import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
    it('should pass a basic assertion', () => {
        expect(1 + 1).toBe(2);
    });

    it('should work with strings', () => {
        expect('hello').toBe('hello');
    });

    it('should work with objects', () => {
        const obj = { name: 'test', value: 123 };
        expect(obj).toEqual({ name: 'test', value: 123 });
    });
});
