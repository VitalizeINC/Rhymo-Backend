import mongoose, { Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const wordBatchSchema = new Schema({
    batch: { 
        type: Schema.Types.ObjectId, 
        ref: 'Batch', 
        required: true 
    },
    grapheme: { 
        type: String, 
        required: true 
    },
    phoneme: { 
        type: [String], 
        required: true 
    },
    organizedGrapheme: { 
        type: String, 
        required: true 
    },
    wawOExceptionIdx: { 
        type: [Number], 
        default: [] 
    },
    silentWawIdx: { 
        type: [Number], 
        default: [] 
    },
    unwrittenAPhoneIdx: { 
        type: [Number], 
        default: [] 
    },
    spokenAGraphemeIdx: { 
        type: [Number], 
        default: [] 
    },
    isVariant: { 
        type: Boolean, 
        default: false 
    },
    variantNum: { 
        type: Number, 
        default: null 
    },
    variantOfIndex: { 
        type: Number, 
        default: null 
    },
    rowIndex: { 
        type: Number, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'processed', 'failed'], 
        default: 'pending' 
    },
    errorMessage: { 
        type: String, 
        default: null 
    },
    processedAt: { 
        type: Date, 
        default: null 
    },
    processedParts: { 
        type: [String], 
        default: [] 
    },
    processedPhonemes: { 
        type: [String], 
        default: [] 
    },
    addedToWords: { 
        type: Boolean, 
        default: false 
    }
}, { 
    timestamps: true, 
    toJSON: { virtuals: true } 
});

wordBatchSchema.plugin(mongoosePaginate);

// Index for better query performance
wordBatchSchema.index({ batch: 1, rowIndex: 1 });
wordBatchSchema.index({ batch: 1, status: 1 });
wordBatchSchema.index({ grapheme: 1 });

export default mongoose.model('WordBatch', wordBatchSchema);
