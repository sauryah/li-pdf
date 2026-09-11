package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port         string
	DatabaseURL  string
	RedisURL     string
	StorageType  string // "s3", "r2", "local"
	StorageDir   string // for local testing
	S3Endpoint   string
	S3Region     string
	S3Bucket     string
	S3AccessKey  string
	S3SecretKey  string
	S3UseSSL     bool
	DefaultTTL   time.Duration
	ProTTL       time.Duration
	WorkerID     string
	MaxUploadMB  int64
}

func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "8085"),
		DatabaseURL:  getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5435/lipdf?sslmode=disable"),
		RedisURL:     getEnv("REDIS_URL", "redis://localhost:6385"),
		StorageType:  getEnv("STORAGE_TYPE", "local"),
		StorageDir:   getEnv("STORAGE_DIR", "./data/storage"),
		S3Endpoint:   getEnv("S3_ENDPOINT", "http://localhost:9005"),
		S3Region:     getEnv("S3_REGION", "us-east-1"),
		S3Bucket:     getEnv("S3_BUCKET", "li-pdf-ephemeral"),
		S3AccessKey:  getEnv("S3_ACCESS_KEY", "minioadmin"),
		S3SecretKey:  getEnv("S3_SECRET_KEY", "minioadmin"),
		S3UseSSL:     getEnvBool("S3_USE_SSL", false),
		DefaultTTL:   time.Hour,
		ProTTL:       24 * time.Hour,
		WorkerID:     getEnv("WORKER_ID", "worker-default"),
		MaxUploadMB:  getEnvInt64("MAX_UPLOAD_MB", 500),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if val := os.Getenv(key); val != "" {
		b, err := strconv.ParseBool(val)
		if err == nil {
			return b
		}
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if val := os.Getenv(key); val != "" {
		n, err := strconv.ParseInt(val, 10, 64)
		if err == nil {
			return n
		}
	}
	return fallback
}
