import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Batch from './app/models/batch.js';
import WordBatch from './app/models/wordBatch.js';
import Word from './app/models/word.js';
import User from './app/models/user.js';
import batchController from './app/http/api/controllers/batchController.js';

const NIM_FASELEH_CHAR = String.fromCharCode(0x200C);
const TEST_WORD = `کاسِه${NIM_FASELEH_CHAR}تُرمُز`;

async function demonstrate() {
    try {
        // Connect to database
        await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/rhymo_test');
        console.log('Connected to database\n');

        // Create test user
        let testUser = await User.findOne({ email: 'demo@test.com' });
        if (!testUser) {
            testUser = new User({
                name: 'Demo User',
                email: 'demo@test.com',
                password: 'password123',
                admin: true,
                emailVerified: true
            });
            await testUser.save();
        }

        // Create test batch
        const testBatch = new Batch({
            fileName: 'demo-batch.csv',
            originalFileName: 'demo-batch.csv',
            filePath: '/demo/path/demo-batch.csv',
            fileSize: 1024,
            mimeType: 'text/csv',
            uploadedBy: testUser._id,
            status: 'completed'
        });
        await testBatch.save();

        // Create WordBatch record with nim faseleh
        const wordBatch = new WordBatch({
            batch: testBatch._id,
            grapheme: TEST_WORD,
            phoneme: ['k', 'A', 's', 'e', 't', 'e', 'r', 'm', 'z'],
            organizedGrapheme: TEST_WORD,
            wawOExceptionIdx: [],
            silentWawIdx: [],
            unwrittenAPhoneIdx: [],
            spokenAGraphemeIdx: [],
            isVariant: false,
            rowIndex: 1,
            status: 'pending'
        });
        await wordBatch.save();

        console.log('='.repeat(60));
        console.log('INPUT:');
        console.log('='.repeat(60));
        console.log(`WordBatch Record:`);
        console.log(`  - organizedGrapheme: "${TEST_WORD}"`);
        console.log(`  - Contains nim faseleh: ${TEST_WORD.includes(NIM_FASELEH_CHAR)}`);
        console.log(`  - Parts: ${TEST_WORD.split(NIM_FASELEH_CHAR).map(p => `"${p}"`).join(', ')}`);
        console.log(`  - Status: pending`);
        console.log('');

        // Process the batch
        const req = {
            params: { batchId: testBatch._id.toString() },
            user: { id: testUser._id.toString() }
        };

        let responseData = null;
        const res = {
            json: (data) => {
                responseData = data;
            },
            status: (code) => ({
                json: (data) => {
                    responseData = data;
                }
            })
        };

        console.log('Processing...\n');
        await batchController.processWordBatchRecords(req, res);

        // Wait a bit for async operations
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('='.repeat(60));
        console.log('OUTPUT:');
        console.log('='.repeat(60));
        console.log(`Response: ${JSON.stringify(responseData, null, 2)}\n`);

        // Get all WordBatch records
        const allWordBatches = await WordBatch.find({
            batch: testBatch._id
        }).sort({ rowIndex: 1 });

        console.log(`Total WordBatch Records Created: ${allWordBatches.length}`);
        console.log('');
        allWordBatches.forEach((wb, index) => {
            console.log(`${index + 1}. WordBatch Record:`);
            console.log(`   - organizedGrapheme: "${wb.organizedGrapheme}"`);
            console.log(`   - status: ${wb.status}`);
            console.log(`   - processedParts: [${wb.processedParts?.join(', ') || 'N/A'}]`);
            console.log(`   - processedPhonemes: [${wb.processedPhonemes?.join(', ') || 'N/A'}]`);
            console.log(`   - addedToWords: ${wb.addedToWords}`);
            console.log('');
        });

        // Get all Word documents
        const allWords = await Word.find({
            batchId: testBatch._id
        });

        console.log(`Total Word Documents Created: ${allWords.length}`);
        console.log('');
        allWords.forEach((word, index) => {
            console.log(`${index + 1}. Word Document:`);
            console.log(`   - fullWord: "${word.fullWord}"`);
            console.log(`   - heja: [${word.heja?.join(', ') || 'N/A'}]`);
            console.log(`   - ava: [${word.ava?.join(', ') || 'N/A'}]`);
            console.log(`   - hejaCounter: ${word.hejaCounter}`);
            console.log('');
        });

        // Cleanup
        await WordBatch.deleteMany({ batch: testBatch._id });
        await Word.deleteMany({ batchId: testBatch._id });
        await Batch.findByIdAndDelete(testBatch._id);
        await User.deleteMany({ email: 'demo@test.com' });

        console.log('='.repeat(60));
        console.log('Demo completed. Test data cleaned up.');
        console.log('='.repeat(60));

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

demonstrate();

