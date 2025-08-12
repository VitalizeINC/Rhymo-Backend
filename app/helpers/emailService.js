import nodemailer from 'nodemailer';
import EmailQueue from '../models/emailQueue.js';

class EmailService {
    constructor() {
        this.smtp2goApiKey = process.env.SMTP2GO_API_KEY || 'api-92185494F7EF46419713E65A00EE34B9';
        this.fromEmail = process.env.FROM_EMAIL || 'noreply@rhymo.com';
        this.fromName = process.env.FROM_NAME || 'Rhymo Team';
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        // Retry configuration
        this.maxRetries = parseInt(process.env.EMAIL_MAX_RETRIES) || 3;
        this.retryDelays = [5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000]; // 5min, 15min, 30min
        this.emailQueue = new Map(); // In-memory fallback queue
        this.useDatabaseQueue = process.env.USE_DATABASE_EMAIL_QUEUE !== 'false'; // Default to true
        
        // Configure SMTP2GO transporter
        this.transporter = nodemailer.createTransport({
            host: 'mail.smtp2go.com',
            port: 2525, // SMTP2GO SMTP port
            secure: false, // true for 465, false for other ports
            auth: {
                user: this.smtp2goApiKey,
                pass: this.smtp2goApiKey
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Start the retry queue processor
        this.startRetryProcessor();
    }

    async sendEmail(to, subject, html, text = null, retryCount = 0, emailType = 'custom', metadata = {}) {
        try {
            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: to,
                subject: subject,
                html: html,
                text: text || this.stripHtml(html)
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email sending failed:', error);
            
            // If we haven't exceeded max retries, add to retry queue
            if (retryCount < this.maxRetries) {
                await this.addToRetryQueue(to, subject, html, text, retryCount + 1, emailType, metadata, error.message);
                return { success: false, error: error.message, queuedForRetry: true };
            }
            
            return { success: false, error: error.message, maxRetriesExceeded: true };
        }
    }

    async addToRetryQueue(to, subject, html, text, retryCount, emailType, metadata, lastError) {
        const retryDelay = this.retryDelays[retryCount - 1] || this.retryDelays[this.retryDelays.length - 1];
        const nextRetryAt = new Date(Date.now() + retryDelay);
        
        if (this.useDatabaseQueue) {
            try {
                // Store in database
                await EmailQueue.create({
                    to,
                    subject,
                    html,
                    text,
                    retryCount,
                    maxRetries: this.maxRetries,
                    nextRetryAt,
                    lastError,
                    status: 'pending',
                    emailType,
                    metadata
                });
                console.log(`Email queued for retry #${retryCount} at ${nextRetryAt.toISOString()} (database)`);
            } catch (dbError) {
                console.error('Failed to store email in database queue, falling back to memory:', dbError);
                // Fallback to in-memory queue
                this.addToMemoryQueue(to, subject, html, text, retryCount, emailType, metadata, lastError);
            }
        } else {
            // Use in-memory queue
            this.addToMemoryQueue(to, subject, html, text, retryCount, emailType, metadata, lastError);
        }
    }

    addToMemoryQueue(to, subject, html, text, retryCount, emailType, metadata, lastError) {
        const queueKey = `${to}-${subject}-${Date.now()}`;
        const retryDelay = this.retryDelays[retryCount - 1] || this.retryDelays[this.retryDelays.length - 1];
        const retryTime = Date.now() + retryDelay;
        
        this.emailQueue.set(queueKey, {
            to,
            subject,
            html,
            text,
            retryCount,
            retryTime,
            emailType,
            metadata,
            lastError,
            createdAt: Date.now()
        });

        console.log(`Email queued for retry #${retryCount} at ${new Date(retryTime).toISOString()} (memory)`);
    }

    async startRetryProcessor() {
        // Process retry queue every minute
        setInterval(() => {
            this.processRetryQueue();
        }, 60 * 1000); // 1 minute

        console.log('Email retry processor started');
    }

    async processRetryQueue() {
        try {
            if (this.useDatabaseQueue) {
                await this.processDatabaseQueue();
            } else {
                await this.processMemoryQueue();
            }
        } catch (error) {
            console.error('Error processing email retry queue:', error);
        }
    }

    async processDatabaseQueue() {
        const now = new Date();
        
        // Find emails ready for retry
        const emailsToRetry = await EmailQueue.find({
            status: 'pending',
            nextRetryAt: { $lte: now },
            retryCount: { $lt: this.maxRetries }
        }).limit(10); // Process 10 emails at a time

        for (const emailData of emailsToRetry) {
            try {
                console.log(`Retrying email to ${emailData.to} (attempt ${emailData.retryCount + 1})`);
                
                const result = await this.sendEmail(
                    emailData.to,
                    emailData.subject,
                    emailData.html,
                    emailData.text,
                    emailData.retryCount + 1,
                    emailData.emailType,
                    emailData.metadata
                );

                if (result.success) {
                    await emailData.markAsSent();
                    console.log(`Email retry successful for ${emailData.to}`);
                } else if (result.maxRetriesExceeded) {
                    await emailData.markAsFailed(result.error);
                    console.error(`Email failed permanently for ${emailData.to} after ${emailData.retryCount + 1} attempts`);
                } else if (result.queuedForRetry) {
                    // Update retry count and next retry time
                    const retryDelay = this.retryDelays[emailData.retryCount] || this.retryDelays[this.retryDelays.length - 1];
                    const nextRetryAt = new Date(Date.now() + retryDelay);
                    await emailData.incrementRetry(nextRetryAt);
                }
                
            } catch (error) {
                console.error(`Error processing retry for ${emailData.to}:`, error);
                await emailData.markAsFailed(error.message);
            }
        }
    }

    async processMemoryQueue() {
        const now = Date.now();
        const emailsToRetry = [];

        // Find emails ready for retry
        for (const [key, emailData] of this.emailQueue.entries()) {
            if (emailData.retryTime <= now) {
                emailsToRetry.push({ key, ...emailData });
            }
        }

        // Process emails ready for retry
        for (const emailData of emailsToRetry) {
            try {
                console.log(`Retrying email to ${emailData.to} (attempt ${emailData.retryCount})`);
                
                const result = await this.sendEmail(
                    emailData.to,
                    emailData.subject,
                    emailData.html,
                    emailData.text,
                    emailData.retryCount,
                    emailData.emailType,
                    emailData.metadata
                );

                if (result.success) {
                    // Remove from queue on success
                    this.emailQueue.delete(emailData.key);
                    console.log(`Email retry successful for ${emailData.to}`);
                } else if (result.maxRetriesExceeded) {
                    // Remove from queue if max retries exceeded
                    this.emailQueue.delete(emailData.key);
                    console.error(`Email failed permanently for ${emailData.to} after ${emailData.retryCount} attempts`);
                }
                // If queuedForRetry, it will be handled in the next retry cycle
                
            } catch (error) {
                console.error(`Error processing retry for ${emailData.to}:`, error);
            }
        }
    }

    // Get queue status for monitoring
    async getQueueStatus() {
        if (this.useDatabaseQueue) {
            const [pending, failed, sent] = await Promise.all([
                EmailQueue.countDocuments({ status: 'pending' }),
                EmailQueue.countDocuments({ status: 'failed' }),
                EmailQueue.countDocuments({ status: 'sent' })
            ]);

            const pendingEmails = await EmailQueue.find({ status: 'pending' })
                .select('to subject retryCount nextRetryAt createdAt emailType')
                .sort({ nextRetryAt: 1 })
                .limit(10);

            const failedEmails = await EmailQueue.find({ status: 'failed' })
                .select('to subject retryCount lastError createdAt emailType')
                .sort({ updatedAt: -1 })
                .limit(10);

            return {
                pending,
                failed,
                sent,
                total: pending + failed + sent,
                pendingEmails: pendingEmails.map(email => ({
                    to: email.to,
                    subject: email.subject,
                    retryCount: email.retryCount,
                    nextRetry: email.nextRetryAt,
                    createdAt: email.createdAt,
                    emailType: email.emailType
                })),
                failedEmails: failedEmails.map(email => ({
                    to: email.to,
                    subject: email.subject,
                    retryCount: email.retryCount,
                    lastError: email.lastError,
                    createdAt: email.createdAt,
                    emailType: email.emailType
                }))
            };
        } else {
            // Memory queue status
            const now = Date.now();
            const pending = [];
            const failed = [];

            for (const [key, emailData] of this.emailQueue.entries()) {
                const emailInfo = {
                    to: emailData.to,
                    subject: emailData.subject,
                    retryCount: emailData.retryCount,
                    nextRetry: new Date(emailData.retryTime),
                    createdAt: new Date(emailData.createdAt),
                    emailType: emailData.emailType
                };

                if (emailData.retryCount >= this.maxRetries) {
                    failed.push(emailInfo);
                } else {
                    pending.push(emailInfo);
                }
            }

            return {
                pending: pending.length,
                failed: failed.length,
                sent: 0,
                total: this.emailQueue.size,
                pendingEmails: pending,
                failedEmails: failed
            };
        }
    }

    // Clear queue (useful for testing or maintenance)
    async clearQueue() {
        if (this.useDatabaseQueue) {
            const result = await EmailQueue.deleteMany({ status: 'pending' });
            console.log(`Email queue cleared. Removed ${result.deletedCount} emails from database.`);
            return result.deletedCount;
        } else {
            const size = this.emailQueue.size;
            this.emailQueue.clear();
            console.log(`Email queue cleared. Removed ${size} emails from memory.`);
            return size;
        }
    }

    async sendPasswordResetEmail(email, resetCode, userName = '') {
        const subject = 'کد بازیابی رمز عبور - Rhymo';
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>بازیابی رمز عبور</title>
                <style>
                    body { font-family: 'Tahoma', Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .code { background: #fff; border: 2px solid #667eea; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #667eea; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>بازیابی رمز عبور</h1>
                        <p>سامانه شعر و قافیه</p>
                    </div>
                    <div class="content">
                        <p>سلام${userName ? ' ' + userName : ''}،</p>
                        <p>درخواست بازیابی رمز عبور برای حساب کاربری شما دریافت شده است.</p>
                        <p>کد بازیابی شما:</p>
                        
                        <div class="code">
                            ${resetCode}
                        </div>
                        
                        <div class="warning">
                            <strong>توجه:</strong> این کد فقط تا ۱۰ دقیقه معتبر است.
                        </div>
                        
                        <p>اگر شما این درخواست را نکرده‌اید، این ایمیل را نادیده بگیرید.</p>
                        
                        <p>با تشکر،<br>تیم Rhymo</p>
                    </div>
                    <div class="footer">
                        <p>این ایمیل به صورت خودکار ارسال شده است. لطفاً به آن پاسخ ندهید.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail(email, subject, html, null, 0, 'password_reset', { userName });
    }

    async sendWelcomeEmail(email, userName = '') {
        const subject = 'خوش آمدید به Rhymo';
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>خوش آمدید</title>
                <style>
                    body { font-family: 'Tahoma', Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>خوش آمدید!</h1>
                        <p>سامانه شعر و قافیه</p>
                    </div>
                    <div class="content">
                        <p>سلام${userName ? ' ' + userName : ''}،</p>
                        <p>به Rhymo خوش آمدید! ثبت نام شما با موفقیت انجام شد.</p>
                        <p>حالا می‌توانید از تمام امکانات سامانه شعر و قافیه استفاده کنید:</p>
                        <ul>
                            <li>جستجوی کلمات و قافیه‌ها</li>
                            <li>مدیریت کلمات شخصی</li>
                            <li>دسترسی به دایره‌المعارف شعر</li>
                        </ul>
                        
                        <div style="text-align: center;">
                            <a href="${this.frontendUrl}" class="button">شروع کار</a>
                        </div>
                        
                        <p>اگر سوالی دارید، با ما در تماس باشید.</p>
                        
                        <p>با تشکر،<br>تیم Rhymo</p>
                    </div>
                    <div class="footer">
                        <p>این ایمیل به صورت خودکار ارسال شده است. لطفاً به آن پاسخ ندهید.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail(email, subject, html, null, 0, 'welcome', { userName });
    }

    async sendEmailVerification(email, verificationCode, userName = '') {
        const subject = 'کد تایید ایمیل - Rhymo';
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>تایید ایمیل</title>
                <style>
                    body { font-family: 'Tahoma', Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .code { background: #fff; border: 2px solid #667eea; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #667eea; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>تایید ایمیل</h1>
                        <p>سامانه شعر و قافیه</p>
                    </div>
                    <div class="content">
                        <p>سلام${userName ? ' ' + userName : ''}،</p>
                        <p>لطفاً ایمیل خود را تایید کنید تا حساب کاربری شما فعال شود.</p>
                        <p>کد تایید شما:</p>
                        
                        <div class="code">
                            ${verificationCode}
                        </div>
                        
                        <div class="warning">
                            <strong>توجه:</strong> این کد فقط تا ۱۰ دقیقه معتبر است.
                        </div>
                        
                        <p>با تشکر،<br>تیم Rhymo</p>
                    </div>
                    <div class="footer">
                        <p>این ایمیل به صورت خودکار ارسال شده است. لطفاً به آن پاسخ ندهید.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail(email, subject, html, null, 0, 'verification', { userName, verificationCode });
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
}

export default new EmailService();
