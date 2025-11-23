/**
 * Metrics storage using SQLite database
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { DATABASE_PATH } from './constants';
import { MetricsData } from './types';

export class MetricsStorage {
    private db: Database.Database;

    constructor(dbPath: string = DATABASE_PATH) {
        // Ensure database directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath);
        this.setupDatabase();
    }

    private setupDatabase(): void {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS inference_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inference_time REAL NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        this.db.exec(createTableSQL);
    }

    addMetric(inferenceTime: number): void {
        const stmt = this.db.prepare(
            'INSERT INTO inference_metrics (inference_time) VALUES (?)'
        );
        stmt.run(inferenceTime);
    }

    getRecentMetrics(limit: number = 100): number[] {
        const stmt = this.db.prepare(`
            SELECT inference_time 
            FROM inference_metrics 
            ORDER BY id DESC 
            LIMIT ?
        `);
        const rows = stmt.all(limit) as Array<{ inference_time: number }>;
        return rows.map(row => row.inference_time).reverse();
    }

    getTotalInferences(): number {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM inference_metrics');
        const result = stmt.get() as { count: number };
        return result.count;
    }

    getAverageInferenceTime(): number {
        const stmt = this.db.prepare('SELECT AVG(inference_time) as avg FROM inference_metrics');
        const result = stmt.get() as { avg: number | null };
        return result.avg || 0;
    }

    getAllMetrics(): MetricsData {
        const totalInferences = this.getTotalInferences();
        const avgInferenceTime = this.getAverageInferenceTime();
        const recentTimes = this.getRecentMetrics(100);
        const startIndex = Math.max(0, totalInferences - recentTimes.length);

        return {
            totalInferences,
            avgInferenceTime,
            recentTimes,
            startIndex
        };
    }

    clearMetrics(): void {
        this.db.exec('DELETE FROM inference_metrics');
    }

    close(): void {
        this.db.close();
    }
}
