import chai from 'chai';
import chaiHttp from 'supertest';
import app from '../app/index.js';
import Batch from '../app/models/batch.js';
import WordBatch from '../app/models/wordBatch.js';
import User from '../app/models/user.js';
import fs from 'fs';
import path from 'path';

const expect = chai.expect;
const request = chaiHttp(app);

describe('Batch Upload API', () => {
    let adminToken;
    let adminUser;

    before(async () => {
        // Create a test admin user
        adminUser = new User({
            name: 'Test Admin',
            email: 'admin@test.com',
            password: 'password123',
            admin: true
        });
        await adminUser.save();

        // Login to get token (you'll need to implement this based on your auth system)
        // For now, we'll assume you have a way to get admin tokens
    });

    after(async () => {
        // Clean up test data
        await Batch.deleteMany({});
        await WordBatch.deleteMany({});
        await User.deleteMany({ email: 'admin@test.com' });
    });

    describe('POST /api/v1/admin/upload-batch', () => {
        it('should upload a CSV file successfully', (done) => {
            // Create a test CSV file
            const testCSVContent = `grapheme	phoneme	organized_grapheme	waw_o_exception_idx	silent_waw_idx	unwritten_A_phone_idx	spoken_A_grapheme_idx	is_variant	variant_num	variant_of_index
واترپولو	('v', 'A', 't', 'e', 'r', 'p', 'o', 'l', 'o')	واتِرپولو	5,7				FALSE
دولوکس	('d', 'o', 'l', 'u', 'k', 's')	دولوکس	1				FALSE`;

            const testFilePath = path.join(__dirname, 'test-batch.csv');
            fs.writeFileSync(testFilePath, testCSVContent);

            request
                .post('/api/v1/admin/upload-batch')
                .set('Authorization', `Bearer ${adminToken}`)
                .attach('file', testFilePath)
                .expect(201)
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res.body.success).to.be.true;
                    expect(res.body.data).to.have.property('batchId');
                    expect(res.body.data).to.have.property('fileName');
                    expect(res.body.data).to.have.property('status');

                    // Clean up test file
                    fs.unlinkSync(testFilePath);
                    done();
                });
        });

        it('should reject non-CSV/Excel files', (done) => {
            // Create a test text file
            const testFilePath = path.join(__dirname, 'test.txt');
            fs.writeFileSync(testFilePath, 'This is not a CSV file');

            request
                .post('/api/v1/admin/upload-batch')
                .set('Authorization', `Bearer ${adminToken}`)
                .attach('file', testFilePath)
                .expect(400)
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res.body.success).to.be.false;
                    expect(res.body.message).to.include('Invalid file type');

                    // Clean up test file
                    fs.unlinkSync(testFilePath);
                    done();
                });
        });

        it('should require authentication', (done) => {
            request
                .post('/api/v1/admin/upload-batch')
                .expect(401, done);
        });
    });

    describe('GET /api/v1/admin/batches', () => {
        it('should return list of batches', (done) => {
            request
                .get('/api/v1/admin/batches')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);

                    expect(res.body.success).to.be.true;
                    expect(res.body.data).to.have.property('docs');
                    expect(res.body.data).to.have.property('totalDocs');
                    done();
                });
        });
    });
});
