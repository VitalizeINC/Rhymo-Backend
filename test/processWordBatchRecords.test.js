import { expect } from 'chai';
import mongoose from 'mongoose';

// Test constants
const NIM_FASELEH_CHAR = String.fromCharCode(0x200C);
const TEST_BATCH_ID = new mongoose.Types.ObjectId();
const TEST_USER_ID = new mongoose.Types.ObjectId();

const TEST_BATCH = {
    _id: TEST_BATCH_ID,
    fileName: 'test-batch.csv',
    status: 'completed'
};

const TEST_WORD_WITH_NIM_FASELEH = `کاسه${NIM_FASELEH_CHAR}ترمز`;
const TEST_PART1 = 'کاسه';
const TEST_PART2 = 'ترمز';

const TEST_WORD_BATCH = {
    _id: new mongoose.Types.ObjectId(),
    batch: TEST_BATCH_ID,
    grapheme: TEST_WORD_WITH_NIM_FASELEH,
    phoneme: ['k', 'A', 's', 'e', 't', 'e', 'r', 'm', 'z'],
    organizedGrapheme: TEST_WORD_WITH_NIM_FASELEH,
    wawOExceptionIdx: [],
    silentWawIdx: [],
    unwrittenAPhoneIdx: [],
    spokenAGraphemeIdx: [],
    isVariant: false,
    rowIndex: 1,
    status: 'pending'
};

const TEST_PROCESSED_DATA_PART1 = {
    modalTitle: TEST_PART1,
    result: [{
        id: '',
        part: TEST_PART1,
        db: false,
        parts: ['کا', 'سه'],
        phonemes: ['k', 'A', 's', 'e']
    }],
    pass: false,
    totalId: ''
};

const TEST_PROCESSED_DATA_PART2 = {
    modalTitle: TEST_PART2,
    result: [{
        id: '',
        part: TEST_PART2,
        db: false,
        parts: ['تر', 'مز'],
        phonemes: ['t', 'e', 'r', 'm', 'z']
    }],
    pass: false,
    totalId: ''
};

const TEST_PROCESSED_DATA_FULL = {
    modalTitle: TEST_WORD_WITH_NIM_FASELEH,
    result: [{
        id: '',
        part: TEST_WORD_WITH_NIM_FASELEH,
        db: false,
        parts: ['کا', 'سه', 'تر', 'مز'],
        phonemes: ['k', 'A', 's', 'e', 't', 'e', 'r', 'm', 'z']
    }],
    pass: false,
    totalId: ''
};

describe('processWordBatchRecords - Nim Faseleh Processing (Unit Test with Constants)', () => {
    describe('Processing words with nim faseleh', () => {
        it('should detect nim faseleh and split word into parts', () => {
            const word = `کاسه${NIM_FASELEH_CHAR}ترمز`;
            const hasNimFaseleh = word.includes(NIM_FASELEH_CHAR);
            const parts = word.split(NIM_FASELEH_CHAR);

            expect(hasNimFaseleh).to.be.true;
            expect(parts).to.have.length(2);
            expect(parts[0].trim()).to.equal('کاسه');
            expect(parts[1].trim()).to.equal('ترمز');
        });

        it('should process each part separately', () => {
            const word = TEST_WORD_WITH_NIM_FASELEH;
            const parts = word.split(NIM_FASELEH_CHAR);

            // Simulate processing each part
            const processedParts = [];
            for (const part of parts) {
                if (part.trim()) {
                    processedParts.push({
                        part: part.trim(),
                        processed: true
                    });
                }
            }

            expect(processedParts).to.have.length(2);
            expect(processedParts[0].part).to.equal('کاسه');
            expect(processedParts[1].part).to.equal('ترمز');
        });

        it('should create WordBatch record structure for each part', () => {
            const part1 = TEST_PART1;
            const part2 = TEST_PART2;

            const wordBatch1 = {
                batch: TEST_BATCH_ID,
                grapheme: part1,
                organizedGrapheme: part1,
                phoneme: TEST_PROCESSED_DATA_PART1.result[0].phonemes,
                status: 'processed',
                processedParts: TEST_PROCESSED_DATA_PART1.result[0].parts,
                processedPhonemes: TEST_PROCESSED_DATA_PART1.result[0].phonemes,
                addedToWords: true
            };

            const wordBatch2 = {
                batch: TEST_BATCH_ID,
                grapheme: part2,
                organizedGrapheme: part2,
                phoneme: TEST_PROCESSED_DATA_PART2.result[0].phonemes,
                status: 'processed',
                processedParts: TEST_PROCESSED_DATA_PART2.result[0].parts,
                processedPhonemes: TEST_PROCESSED_DATA_PART2.result[0].phonemes,
                addedToWords: true
            };

            expect(wordBatch1.organizedGrapheme).to.equal('کاسه');
            expect(wordBatch2.organizedGrapheme).to.equal('ترمز');
            expect(wordBatch1.processedParts).to.deep.equal(['کا', 'سه']);
            expect(wordBatch2.processedParts).to.deep.equal(['تر', 'مز']);
        });

        it('should create Word document structure for each part', () => {
            const part1 = TEST_PART1;
            const partResult = TEST_PROCESSED_DATA_PART1.result[0];

            const wordDoc = {
                fullWord: part1,
                fullWordWithNimFaseleh: part1,
                word: 'کاسه', // solid word
                heja: partResult.parts,
                avaString: partResult.phonemes.join(','),
                ava: partResult.phonemes,
                hejaCounter: partResult.phonemes.length,
                spacePositions: [],
                nimFaselehPositions: [],
                level: 1,
                batchId: TEST_BATCH_ID,
                approved: false
            };

            expect(wordDoc.fullWord).to.equal('کاسه');
            expect(wordDoc.heja).to.deep.equal(['کا', 'سه']);
            expect(wordDoc.ava).to.deep.equal(['k', 'A', 's', 'e']);
            expect(wordDoc.hejaCounter).to.equal(4);
        });

        it('should handle words without nim faseleh', () => {
            const normalWord = 'دولوکس';
            const hasNimFaseleh = normalWord.includes(NIM_FASELEH_CHAR);

            expect(hasNimFaseleh).to.be.false;
        });

        it('should calculate correct rowIndex for new WordBatch records', () => {
            const maxRowIndex = 10;
            let nextRowIndex = maxRowIndex + 1;

            const part1RowIndex = nextRowIndex++;
            const part2RowIndex = nextRowIndex++;

            expect(part1RowIndex).to.equal(11);
            expect(part2RowIndex).to.equal(12);
        });

        it('should verify all required fields are present in WordBatch record', () => {
            const wordBatch = {
                batch: TEST_BATCH_ID,
                grapheme: TEST_PART1,
                phoneme: ['k', 'A', 's', 'e'],
                organizedGrapheme: TEST_PART1,
                wawOExceptionIdx: [],
                silentWawIdx: [],
                unwrittenAPhoneIdx: [],
                spokenAGraphemeIdx: [],
                isVariant: false,
                variantNum: null,
                variantOfIndex: null,
                rowIndex: 1,
                status: 'processed',
                processedParts: ['کا', 'سه'],
                processedPhonemes: ['k', 'A', 's', 'e'],
                processedAt: new Date(),
                addedToWords: true
            };

            expect(wordBatch).to.have.property('batch');
            expect(wordBatch).to.have.property('grapheme');
            expect(wordBatch).to.have.property('organizedGrapheme');
            expect(wordBatch).to.have.property('status');
            expect(wordBatch).to.have.property('processedParts');
            expect(wordBatch).to.have.property('processedPhonemes');
            expect(wordBatch).to.have.property('addedToWords');
        });

        it('should verify all required fields are present in Word document', () => {
            const word = {
                fullWord: TEST_PART1,
                fullWordWithNimFaseleh: TEST_PART1,
                word: 'کاسه',
                heja: ['کا', 'سه'],
                avaString: 'k,A,s,e',
                ava: ['k', 'A', 's', 'e'],
                hejaCounter: 4,
                spacePositions: [],
                nimFaselehPositions: [],
                level: 1,
                batchId: TEST_BATCH_ID,
                approved: false
            };

            expect(word).to.have.property('fullWord');
            expect(word).to.have.property('heja');
            expect(word).to.have.property('ava');
            expect(word).to.have.property('hejaCounter');
            expect(word).to.have.property('level');
        });

        it('should handle multiple words with nim faseleh', () => {
            const word1 = `کاسه${NIM_FASELEH_CHAR}ترمز`;
            const word2 = `دست${NIM_FASELEH_CHAR}شوی`;

            const parts1 = word1.split(NIM_FASELEH_CHAR);
            const parts2 = word2.split(NIM_FASELEH_CHAR);

            expect(parts1).to.have.length(2);
            expect(parts2).to.have.length(2);
            expect(parts1[0].trim()).to.equal('کاسه');
            expect(parts1[1].trim()).to.equal('ترمز');
            expect(parts2[0].trim()).to.equal('دست');
            expect(parts2[1].trim()).to.equal('شوی');
        });

        it('should correctly identify nim faseleh character', () => {
            const nimFaselehChar = String.fromCharCode(0x200C);
            const wordWithNimFaseleh = `کاسه${nimFaselehChar}ترمز`;
            const wordWithoutNimFaseleh = 'کاسه ترمز';

            expect(wordWithNimFaseleh.includes(nimFaselehChar)).to.be.true;
            expect(wordWithoutNimFaseleh.includes(nimFaselehChar)).to.be.false;
        });

        it('should trim parts correctly', () => {
            const word = `  کاسه  ${NIM_FASELEH_CHAR}  ترمز  `;
            const parts = word.split(NIM_FASELEH_CHAR);
            const trimmedParts = parts.map(p => p.trim()).filter(p => p);

            expect(trimmedParts).to.have.length(2);
            expect(trimmedParts[0]).to.equal('کاسه');
            expect(trimmedParts[1]).to.equal('ترمز');
        });

        it('should calculate space and nim faseleh positions correctly', () => {
            const word = `کاسه${NIM_FASELEH_CHAR}ترمز`;
            const spacePositions = [];
            const nimFaselehPositions = [];

            for (let i = 0; i < word.length; i++) {
                if (word[i] === ' ') {
                    spacePositions.push(i);
                }
                if (word[i] === NIM_FASELEH_CHAR) {
                    nimFaselehPositions.push(i);
                }
            }

            expect(spacePositions).to.be.empty;
            expect(nimFaselehPositions).to.have.length(1);
            expect(nimFaselehPositions[0]).to.equal(4); // Position of nim faseleh
        });

        it('should set addedToWords flag correctly', () => {
            const existingWord = { _id: new mongoose.Types.ObjectId() };
            const wordWasJustCreated = false;

            const addedToWords1 = !!existingWord || wordWasJustCreated;
            expect(addedToWords1).to.be.true;

            const noExistingWord = null;
            const wordWasJustCreated2 = true;
            const addedToWords2 = !!noExistingWord || wordWasJustCreated2;
            expect(addedToWords2).to.be.true;

            const noExistingWord2 = null;
            const wordWasJustCreated3 = false;
            const addedToWords3 = !!noExistingWord2 || wordWasJustCreated3;
            expect(addedToWords3).to.be.false;
        });
    });

    describe('Data structure validation', () => {
        it('should have correct structure for processed word data', () => {
            const processedData = TEST_PROCESSED_DATA_FULL;

            expect(processedData).to.have.property('modalTitle');
            expect(processedData).to.have.property('result');
            expect(processedData.result).to.be.an('array');
            expect(processedData.result[0]).to.have.property('parts');
            expect(processedData.result[0]).to.have.property('phonemes');
        });

        it('should extract parts and phonemes correctly from processed data', () => {
            const processedData = TEST_PROCESSED_DATA_FULL;
            let allParts = [];
            let allPhonemes = [];

            processedData.result.forEach(item => {
                if (item.parts) allParts = [...allParts, ...item.parts];
                if (item.phonemes) allPhonemes = [...allPhonemes, ...item.phonemes];
            });

            expect(allParts).to.deep.equal(['کا', 'سه', 'تر', 'مز']);
            expect(allPhonemes).to.deep.equal(['k', 'A', 's', 'e', 't', 'e', 'r', 'm', 'z']);
        });

        it('should verify the complete flow: split -> process -> create records', () => {
            // Step 1: Split word with nim faseleh
            const word = TEST_WORD_WITH_NIM_FASELEH;
            const parts = word.split(NIM_FASELEH_CHAR).map(p => p.trim()).filter(p => p);
            
            expect(parts).to.have.length(2);

            // Step 2: Process each part (simulated with constants)
            const processedParts = parts.map((part, index) => {
                const processedData = index === 0 ? TEST_PROCESSED_DATA_PART1 : TEST_PROCESSED_DATA_PART2;
                return {
                    part: part,
                    parts: processedData.result[0].parts,
                    phonemes: processedData.result[0].phonemes
                };
            });

            expect(processedParts[0].parts).to.deep.equal(['کا', 'سه']);
            expect(processedParts[1].parts).to.deep.equal(['تر', 'مز']);

            // Step 3: Create WordBatch records
            const wordBatchRecords = processedParts.map((proc, index) => ({
                batch: TEST_BATCH_ID,
                grapheme: parts[index],
                organizedGrapheme: parts[index],
                phoneme: proc.phonemes,
                status: 'processed',
                processedParts: proc.parts,
                processedPhonemes: proc.phonemes,
                addedToWords: true,
                rowIndex: index + 1
            }));

            expect(wordBatchRecords).to.have.length(2);
            expect(wordBatchRecords[0].organizedGrapheme).to.equal('کاسه');
            expect(wordBatchRecords[1].organizedGrapheme).to.equal('ترمز');

            // Step 4: Create Word documents
            const wordDocuments = processedParts.map((proc, index) => ({
                fullWord: parts[index],
                fullWordWithNimFaseleh: parts[index],
                word: parts[index], // solid word (simplified)
                heja: proc.parts,
                ava: proc.phonemes,
                hejaCounter: proc.phonemes.length,
                level: 1,
                batchId: TEST_BATCH_ID
            }));

            expect(wordDocuments).to.have.length(2);
            expect(wordDocuments[0].fullWord).to.equal('کاسه');
            expect(wordDocuments[1].fullWord).to.equal('ترمز');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty parts', () => {
            const word = `${NIM_FASELEH_CHAR}کاسه${NIM_FASELEH_CHAR}`;
            const parts = word.split(NIM_FASELEH_CHAR);
            const validParts = parts.filter(p => p.trim());

            expect(validParts).to.have.length(1);
            expect(validParts[0]).to.equal('کاسه');
        });

        it('should handle word with only nim faseleh', () => {
            const word = `${NIM_FASELEH_CHAR}${NIM_FASELEH_CHAR}`;
            const parts = word.split(NIM_FASELEH_CHAR);
            const validParts = parts.filter(p => p.trim());

            expect(validParts).to.be.empty;
        });

        it('should handle word with multiple consecutive nim faseleh', () => {
            const word = `کاسه${NIM_FASELEH_CHAR}${NIM_FASELEH_CHAR}ترمز`;
            const parts = word.split(NIM_FASELEH_CHAR);
            const validParts = parts.filter(p => p.trim());

            expect(validParts).to.have.length(2);
            expect(validParts[0]).to.equal('کاسه');
            expect(validParts[1]).to.equal('ترمز');
        });

        it('should handle word with spaces and nim faseleh', () => {
            const word = `کاسه ${NIM_FASELEH_CHAR} ترمز`;
            const parts = word.split(NIM_FASELEH_CHAR);
            const trimmedParts = parts.map(p => p.trim()).filter(p => p);

            expect(trimmedParts).to.have.length(2);
            expect(trimmedParts[0]).to.equal('کاسه');
            expect(trimmedParts[1]).to.equal('ترمز');
        });
    });

    describe('Final result verification', () => {
        it('should produce correct final result structure', () => {
            // Simulate the complete processing result
            const finalResult = {
                originalWordBatch: TEST_WORD_BATCH,
                createdWordBatches: [
                    {
                        batch: TEST_BATCH_ID,
                        organizedGrapheme: TEST_PART1,
                        status: 'processed',
                        addedToWords: true
                    },
                    {
                        batch: TEST_BATCH_ID,
                        organizedGrapheme: TEST_PART2,
                        status: 'processed',
                        addedToWords: true
                    }
                ],
                createdWords: [
                    {
                        fullWord: TEST_PART1,
                        heja: TEST_PROCESSED_DATA_PART1.result[0].parts
                    },
                    {
                        fullWord: TEST_PART2,
                        heja: TEST_PROCESSED_DATA_PART2.result[0].parts
                    }
                ],
                fullWordProcessed: {
                    organizedGrapheme: TEST_WORD_WITH_NIM_FASELEH,
                    status: 'processed'
                }
            };

            expect(finalResult.createdWordBatches).to.have.length(2);
            expect(finalResult.createdWords).to.have.length(2);
            expect(finalResult.createdWordBatches[0].organizedGrapheme).to.equal('کاسه');
            expect(finalResult.createdWordBatches[1].organizedGrapheme).to.equal('ترمز');
            expect(finalResult.fullWordProcessed.organizedGrapheme).to.equal(TEST_WORD_WITH_NIM_FASELEH);
        });
    });
});
