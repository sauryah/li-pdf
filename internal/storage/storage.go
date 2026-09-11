package storage

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/li-pdf/li-pdf/internal/config"
)

type PresignedUpload struct {
	UploadURL  string    `json:"upload_url"`
	StorageKey string    `json:"storage_key"`
	ExpiresAt  time.Time `json:"expires_at"`
}

type StorageManager interface {
	GeneratePresignedUpload(ctx context.Context, storageKey string, mimeType string, ttl time.Duration) (*PresignedUpload, error)
	GeneratePresignedDownload(ctx context.Context, storageKey string, filename string, ttl time.Duration) (string, error)
	DownloadFile(ctx context.Context, storageKey string, targetLocalPath string) error
	UploadFile(ctx context.Context, localPath string, storageKey string, mimeType string) error
	DeleteFile(ctx context.Context, storageKey string) error
}

// S3StorageManager implements S3 / Cloudflare R2 presigned storage.
type S3StorageManager struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	bucket        string
	endpoint      string
}

func NewS3StorageManager(ctx context.Context, cfg *config.Config) (*S3StorageManager, error) {
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...any) (aws.Endpoint, error) {
		if cfg.S3Endpoint != "" {
			return aws.Endpoint{
				PartitionID:       "aws",
				URL:               cfg.S3Endpoint,
				SigningRegion:     cfg.S3Region,
				HostnameImmutable: true,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.S3Region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")),
		awsconfig.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load aws config: %w", err)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true // compatible with MinIO and Cloudflare R2
	})

	presignClient := s3.NewPresignClient(s3Client)

	return &S3StorageManager{
		client:        s3Client,
		presignClient: presignClient,
		bucket:        cfg.S3Bucket,
		endpoint:      cfg.S3Endpoint,
	}, nil
}

func (s *S3StorageManager) GeneratePresignedUpload(ctx context.Context, storageKey string, mimeType string, ttl time.Duration) (*PresignedUpload, error) {
	req, err := s.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(storageKey),
		ContentType: aws.String(mimeType),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return nil, fmt.Errorf("failed to presign put object: %w", err)
	}

	return &PresignedUpload{
		UploadURL:  req.URL,
		StorageKey: storageKey,
		ExpiresAt:  time.Now().Add(ttl),
	}, nil
}

func (s *S3StorageManager) GeneratePresignedDownload(ctx context.Context, storageKey string, filename string, ttl time.Duration) (string, error) {
	disposition := fmt.Sprintf("attachment; filename=\"%s\"", filename)
	req, err := s.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket:                     aws.String(s.bucket),
		Key:                        aws.String(storageKey),
		ResponseContentDisposition: aws.String(disposition),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("failed to presign get object: %w", err)
	}

	return req.URL, nil
}

func (s *S3StorageManager) DownloadFile(ctx context.Context, storageKey string, targetLocalPath string) error {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(storageKey),
	})
	if err != nil {
		return fmt.Errorf("failed to get s3 object: %w", err)
	}
	defer out.Body.Close()

	if err := os.MkdirAll(filepath.Dir(targetLocalPath), 0755); err != nil {
		return err
	}

	f, err := os.Create(targetLocalPath)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, out.Body)
	return err
}

func (s *S3StorageManager) UploadFile(ctx context.Context, localPath string, storageKey string, mimeType string) error {
	f, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(storageKey),
		Body:        f,
		ContentType: aws.String(mimeType),
	})
	return err
}

func (s *S3StorageManager) DeleteFile(ctx context.Context, storageKey string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(storageKey),
	})
	return err
}

// LocalStorageManager provides filesystem storage for local development/testing.
type LocalStorageManager struct {
	baseDir    string
	apiBaseURL string
	secretKey  string
}

func NewLocalStorageManager(baseDir, apiBaseURL string) (*LocalStorageManager, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, err
	}
	return &LocalStorageManager{
		baseDir:    baseDir,
		apiBaseURL: strings.TrimRight(apiBaseURL, "/"),
		secretKey:  "local-dev-secret-key-32-chars-long!",
	}, nil
}

func (l *LocalStorageManager) GeneratePresignedUpload(ctx context.Context, storageKey string, mimeType string, ttl time.Duration) (*PresignedUpload, error) {
	exp := time.Now().Add(ttl).Unix()
	sig := l.signKey(storageKey, exp)
	u := fmt.Sprintf("%s/v1/storage/upload?key=%s&exp=%d&sig=%s", l.apiBaseURL, url.QueryEscape(storageKey), exp, sig)
	return &PresignedUpload{
		UploadURL:  u,
		StorageKey: storageKey,
		ExpiresAt:  time.Unix(exp, 0),
	}, nil
}

func (l *LocalStorageManager) GeneratePresignedDownload(ctx context.Context, storageKey string, filename string, ttl time.Duration) (string, error) {
	exp := time.Now().Add(ttl).Unix()
	sig := l.signKey(storageKey, exp)
	return fmt.Sprintf("%s/v1/storage/download?key=%s&filename=%s&exp=%d&sig=%s",
		l.apiBaseURL, url.QueryEscape(storageKey), url.QueryEscape(filename), exp, sig), nil
}

func (l *LocalStorageManager) DownloadFile(ctx context.Context, storageKey string, targetLocalPath string) error {
	src := filepath.Join(l.baseDir, filepath.FromSlash(storageKey))
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(targetLocalPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(targetLocalPath, data, 0644)
}

func (l *LocalStorageManager) UploadFile(ctx context.Context, localPath string, storageKey string, mimeType string) error {
	dst := filepath.Join(l.baseDir, filepath.FromSlash(storageKey))
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	data, err := os.ReadFile(localPath)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

func (l *LocalStorageManager) DeleteFile(ctx context.Context, storageKey string) error {
	target := filepath.Join(l.baseDir, filepath.FromSlash(storageKey))
	_ = os.Remove(target)
	return nil
}

func (l *LocalStorageManager) VerifySignature(storageKey string, expStr string, sig string) bool {
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return false
	}
	expected := l.signKey(storageKey, exp)
	return hmac.Equal([]byte(expected), []byte(sig))
}

func (l *LocalStorageManager) GetLocalPath(storageKey string) string {
	return filepath.Join(l.baseDir, filepath.FromSlash(storageKey))
}

func (l *LocalStorageManager) signKey(storageKey string, exp int64) string {
	mac := hmac.New(sha256.New, []byte(l.secretKey))
	mac.Write([]byte(fmt.Sprintf("%s:%d", storageKey, exp)))
	return hex.EncodeToString(mac.Sum(nil))
}
