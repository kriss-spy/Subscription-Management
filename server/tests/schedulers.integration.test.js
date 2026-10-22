const cron = require('node-cron');

jest.mock('../config/database', () => ({ createDatabaseConnection: jest.fn() }));
jest.mock('../services/notificationService', () => jest.fn().mockImplementation(() => ({ close: jest.fn() })));
jest.mock('../services/subscriptionManagementService', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../services/exchangeRateService', () => jest.fn().mockImplementation(() => ({ apiKey: 'test' })));

const NotificationScheduler = require('../services/notificationScheduler');
const ExchangeRateScheduler = require('../services/exchangeRateScheduler');
const SubscriptionRenewalScheduler = require('../services/subscriptionRenewalScheduler');
const { createDatabaseConnection } = require('../config/database');

// Use real node-cron tasks to catch incompatible lifecycle APIs after upgrades.
describe('scheduler lifecycle with node-cron', () => {
    afterEach(() => {
        for (const task of cron.getTasks().values()) task.destroy();
    });

    test('notification schedule replaces and disables tasks without leaving registered jobs', () => {
        let settings = { notification_check_time: '09:00', timezone: 'Asia/Shanghai', is_enabled: 1 };
        createDatabaseConnection.mockReturnValue({
            prepare: () => ({ get: () => settings }),
            close: jest.fn(),
        });
        const scheduler = new NotificationScheduler();
        scheduler.start();
        const original = scheduler.job;
        expect(original.getStatus()).toBe('idle');
        expect(scheduler.getStatus()).toEqual({ running: true, nextRun: true });
        scheduler.updateSchedule();
        expect(scheduler.job).toBe(original);
        settings = { ...settings, notification_check_time: '10:00' };
        scheduler.updateSchedule();
        expect(original.getStatus()).toBe('destroyed');
        expect(cron.getTasks().size).toBe(1);
        scheduler.stop();
        scheduler.start();
        expect(scheduler.job.getStatus()).toBe('idle');
        expect(cron.getTasks().size).toBe(1);
        settings = { ...settings, is_enabled: 0 };
        scheduler.updateSchedule();
        expect(scheduler.getStatus()).toEqual({ running: false, nextRun: false });
        expect(cron.getTasks().size).toBe(0);
        scheduler.close();
    });

    test('exchange rate task reports its next run and can restart cleanly', () => {
        const scheduler = new ExchangeRateScheduler({}, 'test');
        scheduler.checkAndUpdateIfNeeded = jest.fn();
        scheduler.start();
        const original = scheduler.task;
        scheduler.start();
        expect(scheduler.task).toBe(original);
        expect(scheduler.getStatus().nextRun).toBeInstanceOf(Date);
        scheduler.stop();
        expect(original.getStatus()).toBe('destroyed');
        expect(scheduler.getStatus().nextRun).toBeNull();
        scheduler.start();
        expect(cron.getTasks().size).toBe(1);
        scheduler.stop();
    });

    test('renewal task reports its next run and cleans up on repeated stops', () => {
        const scheduler = new SubscriptionRenewalScheduler({});
        scheduler.start();
        expect(scheduler.getStatus().nextRun).toBeInstanceOf(Date);
        scheduler.stop();
        scheduler.stop();
        expect(scheduler.getStatus()).toEqual({ isRunning: false, nextRun: null });
        scheduler.start();
        expect(cron.getTasks().size).toBe(1);
        scheduler.stop();
    });
});
