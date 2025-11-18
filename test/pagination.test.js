import request from 'supertest';
import { expect } from 'chai';
import Application from '../app/index.js';

let app;

describe('Rhyme Pagination Tests', () => {
    before(async () => {
        const application = new Application();
        app = application.app;
    });

    it('should return paginated results with correct metadata', async () => {
        // This test assumes you have a word with ID in your database
        // You'll need to replace 'test-word-id' with an actual word ID from your database
        const response = await request(app)
            .get('/api/v1/private/getRhymes')
            .query({
                id: 'test-word-id', // Replace with actual word ID
                filter: 'test',
                page: 1,
                limit: 5
            });

        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('pagination');
        expect(response.body.pagination).to.have.property('currentPage', 1);
        expect(response.body.pagination).to.have.property('itemsPerPage', 5);
        expect(response.body.pagination).to.have.property('totalItems');
        expect(response.body.pagination).to.have.property('totalPages');
        expect(response.body.pagination).to.have.property('hasNextPage');
        expect(response.body.pagination).to.have.property('hasPrevPage');
    });

    it('should handle different page numbers correctly', async () => {
        const response = await request(app)
            .get('/api/v1/private/getRhymes')
            .query({
                id: 'test-word-id', // Replace with actual word ID
                filter: 'test',
                page: 2,
                limit: 3
            });

        expect(response.status).to.equal(200);
        expect(response.body.pagination.currentPage).to.equal(2);
        expect(response.body.pagination.itemsPerPage).to.equal(3);
    });

    it('should handle professional filter parameter', async () => {
        const response = await request(app)
            .get('/api/v1/private/getRhymes')
            .query({
                id: 'test-word-id', // Replace with actual word ID
                filter: 'test',
                professional: 'false',
                page: 1,
                limit: 10
            });

        expect(response.status).to.equal(200);
        // The response should include all words without professional filtering
    });
});
