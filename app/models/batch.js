import mongoose, { Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const batchSchema = new Schema({
    fileName: { 
        type: String, 
        required: true 
    },
    originalFileName: { 
        type: String, 
        required: true 
    },
    filePath: { 
        type: String, 
        required: true 
    },
    fileSize: { 
        type: Number, 
        required: true 
    },
    mimeType: { 
        type: String, 
        required: true 
    },
    uploadedBy: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['uploaded', 'processing', 'completed', 'failed'], 
        default: 'uploaded' 
    },
    totalRecords: { 
        type: Number, 
        default: 0 
    },
    processedRecords: { 
        type: Number, 
        default: 0 
    },
    failedRecords: { 
        type: Number, 
        default: 0 
    },
    processingStartedAt: { 
        type: Date, 
        default: null 
    },
    processingCompletedAt: { 
        type: Date, 
        default: null 
    },
    errorMessage: { 
        type: String, 
        default: null 
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, { 
    timestamps: true, 
    toJSON: { virtuals: true } 
});

batchSchema.plugin(mongoosePaginate);

// Virtual for processing progress percentage
batchSchema.virtual('progressPercentage').get(function() {
    if (this.totalRecords === 0) return 0;
    return Math.round((this.processedRecords / this.totalRecords) * 100);
});

// Virtual for success rate
batchSchema.virtual('successRate').get(function() {
    if (this.totalRecords === 0) return 0;
    return Math.round(((this.totalRecords - this.failedRecords) / this.totalRecords) * 100);
});

export default mongoose.model('Batch', batchSchema);
