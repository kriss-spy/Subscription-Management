const cron = require('node-cron');
const logger = require('../utils/logger');
const SubscriptionManagementService = require('./subscriptionManagementService');

/**
 * 订阅续费定时任务服务
 * 负责处理自动续费和过期订阅的定时检查
 */
class SubscriptionRenewalScheduler {
    constructor(db) {
        this.subscriptionManagementService = new SubscriptionManagementService(db);
        this.isRunning = false;
    }

    /**
     * 启动定时任务
     */
    start() {
        if (this.isRunning) {
            logger.warn('Scheduler service is already running');
            return;
        }

        // 每天凌晨2点执行自动续费和过期处理
        this.dailyTask = cron.createTask('0 2 * * *', async () => {
            logger.info('Starting daily subscription maintenance...');
            await this.runDailyMaintenance();
        }, {
            timezone: "Asia/Shanghai" // 可以根据需要调整时区
        });

        // 启动任务
        this.dailyTask.start();
        this.isRunning = true;
        
        logger.info('Scheduler service started - Daily maintenance scheduled for 2:00 AM');
    }

    /**
     * 停止定时任务
     */
    stop() {
        if (this.dailyTask) {
            this.dailyTask.destroy();
            this.dailyTask = null;
        }
        this.isRunning = false;
        logger.info('Scheduler service stopped');
    }

    /**
     * 执行日常维护任务
     */
    async runDailyMaintenance() {
        try {
            logger.info('Running daily subscription maintenance...');

            // 处理自动续费
            const autoRenewalResult = await this.subscriptionManagementService.processAutoRenewals();
            
            // 处理过期订阅
            const expiredResult = await this.subscriptionManagementService.processExpiredSubscriptions();

            // 记录结果
            const totalProcessed = autoRenewalResult.processed + expiredResult.processed;
            const totalErrors = autoRenewalResult.errors + expiredResult.errors;

            logger.info(`Daily maintenance completed: ${totalProcessed} subscriptions processed, ${totalErrors} errors`);

            if (autoRenewalResult.processed > 0) {
                logger.info(`Auto-renewed ${autoRenewalResult.processed} subscription(s)`);
            }
            if (expiredResult.processed > 0) {
                logger.info(`Cancelled ${expiredResult.processed} expired subscription(s)`);
            }

            return {
                success: true,
                autoRenewalResult,
                expiredResult,
                totalProcessed,
                totalErrors
            };

        } catch (error) {
            logger.error('Error during daily maintenance:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 手动触发维护任务（用于测试或紧急情况）
     */
    async runMaintenanceNow() {
        logger.info('Manual maintenance triggered');
        return await this.runDailyMaintenance();
    }

    /**
     * 获取定时任务状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            nextRun: this.dailyTask ? this.dailyTask.getNextRun() : null
        };
    }
}

module.exports = SubscriptionRenewalScheduler;
