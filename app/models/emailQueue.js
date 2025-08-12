import mongoose, { Schema } from 'mongoose';

const emailQueueSchema = new Schema({
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    nextRetryAt: { type: Date, required: true },
    lastError: { type: String, default: null },
    status: { 
        type: String, 
        enum: ['pending', 'failed', 'sent'], 
        default: 'pending' 
    },
    emailType: { 
        type: String, 
        enum: ['welcome', 'verification', 'password_reset', 'custom'], 
        required: true 
    },
    metadata: { type: Schema.Types.Mixed, default: {} }, // Store additional data like user info
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for efficient querying
emailQueueSchema.index({ status: 1, nextRetryAt: 1 });
emailQueueSchema.index({ emailType: 1, status: 1 });

// Method to check if email should be retried
emailQueueSchema.methods.shouldRetry = function() {
    return this.status === 'pending' && 
           this.retryCount < this.maxRetries && 
           this.nextRetryAt <= new Date();
};

// Method to mark as failed
emailQueueSchema.methods.markAsFailed = function(error) {
    this.status = 'failed';
    this.lastError = error;
    this.updatedAt = new Date();
    return this.save();
};

// Method to mark as sent
emailQueueSchema.methods.markAsSent = function() {
    this.status = 'sent';
    this.updatedAt = new Date();
    return this.save();
};

// Method to increment retry count
emailQueueSchema.methods.incrementRetry = function(nextRetryAt) {
    this.retryCount += 1;
    this.nextRetryAt = nextRetryAt;
    this.updatedAt = new Date();
    return this.save();
};

export default mongoose.model('EmailQueue', emailQueueSchema);
