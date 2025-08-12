import { expect } from 'chai';

describe('Simple Test', () => {
    it('should pass a basic test', () => {
        expect(1 + 1).to.equal(2);
    });

    it('should handle async operations', async () => {
        const result = await Promise.resolve('test');
        expect(result).to.equal('test');
    });
});
