package storage

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/li-pdf/li-pdf/internal/metrics"
)

type StoragePurger struct {
	baseDir string
	storage StorageManager
}

func NewStoragePurger(baseDir string, st StorageManager) *StoragePurger {
	return &StoragePurger{
		baseDir: baseDir,
		storage: st,
	}
}

// PurgeExpired deletes all files in the storage directory whose modification time is older than ttl.
func (p *StoragePurger) PurgeExpired(ctx context.Context, ttl time.Duration) (int, error) {
	if p.baseDir == "" {
		return 0, nil
	}

	cutoff := time.Now().Add(-ttl)
	purgedCount := 0

	err := filepath.Walk(p.baseDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// Don't remove top-level storage directory
		if path == p.baseDir {
			return nil
		}

		if !info.IsDir() {
			if info.ModTime().Before(cutoff) {
				if removeErr := os.Remove(path); removeErr == nil {
					purgedCount++
				}
			}
		} else {
			// Clean up empty directories
			entries, readErr := os.ReadDir(path)
			if readErr == nil && len(entries) == 0 && path != p.baseDir {
				_ = os.Remove(path)
			}
		}

		return nil
	})

	return purgedCount, err
}

// Start runs the purger loop periodically in the background.
func (p *StoragePurger) Start(ctx context.Context, interval time.Duration, ttl time.Duration) {
	log.Printf("[Storage Purger] Started background lifecycle cleaner (Interval: %v, TTL: %v)", interval, ttl)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("[Storage Purger] Stopped")
			return
		case <-ticker.C:
			count, err := p.PurgeExpired(ctx, ttl)
			if err != nil {
				log.Printf("[Storage Purger] Error purging expired files: %v", err)
			} else if count > 0 {
				metrics.DefaultMetrics.RecordPurgedFiles(int64(count))
				log.Printf("[Storage Purger] Successfully purged %d expired ephemeral file(s)", count)
			}
		}
	}
}
