package storage

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
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

func NewLocalStorageManager(baseDir, apiBaseURL, secretKey string) (*LocalStorageManager, error) {
	absBase, err := filepath.Abs(baseDir)
	if err != nil {
		return nil, fmt.Errorf("invalid storage base directory: %w", err)
	}

	if err := os.MkdirAll(absBase, 0755); err != nil {
		return nil, err
	}

	if secretKey == "" {
		// Generate cryptographically secure random token for signing
		randomBytes := make([]byte, 32)
		if _, randErr := rand.Read(randomBytes); randErr == nil {
			secretKey = hex.EncodeToString(randomBytes)
		} else {
			secretKey = fmt.Sprintf("fallback-token-%d", time.Now().UnixNano())
		}
	}

	return &LocalStorageManager{
		baseDir:    absBase,
		apiBaseURL: strings.TrimRight(apiBaseURL, "/"),
		secretKey:  secretKey,
	}, nil
}

func (l *LocalStorageManager) GeneratePresignedUpload(ctx context.Context, storageKey string, mimeType string, ttl time.Duration) (*PresignedUpload, error) {
	if err := l.validateStorageKey(storageKey); err != nil {
		return nil, err
	}
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
	if err := l.validateStorageKey(storageKey); err != nil {
		return "", err
	}
	exp := time.Now().Add(ttl).Unix()
	sig := l.signKey(storageKey, exp)
	return fmt.Sprintf("%s/v1/storage/download?key=%s&filename=%s&exp=%d&sig=%s",
		l.apiBaseURL, url.QueryEscape(storageKey), url.QueryEscape(filename), exp, sig), nil
}

func (l *LocalStorageManager) DownloadFile(ctx context.Context, storageKey string, targetLocalPath string) error {
	srcPath := l.GetLocalPath(storageKey)
	if srcPath == "" {
		return fmt.Errorf("invalid storage key / path traversal detected: %s", storageKey)
	}

	srcFile, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	if err := os.MkdirAll(filepath.Dir(targetLocalPath), 0755); err != nil {
		return err
	}

	dstFile, err := os.Create(targetLocalPath)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return err
	}
	return dstFile.Sync()
}

func (l *LocalStorageManager) UploadFile(ctx context.Context, localPath string, storageKey string, mimeType string) error {
	dstPath := l.GetLocalPath(storageKey)
	if dstPath == "" {
		return fmt.Errorf("invalid storage key / path traversal detected: %s", storageKey)
	}

	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return err
	}

	srcFile, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return err
	}
	return dstFile.Sync()
}

func (l *LocalStorageManager) DeleteFile(ctx context.Context, storageKey string) error {
	target := l.GetLocalPath(storageKey)
	if target == "" {
		return fmt.Errorf("invalid storage key: %s", storageKey)
	}
	_ = os.Remove(target)
	return nil
}

func (l *LocalStorageManager) VerifySignature(storageKey string, expStr string, sig string) bool {
	if err := l.validateStorageKey(storageKey); err != nil {
		return false
	}
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || time.Now().Unix() > exp {
		return false
	}
	expected := l.signKey(storageKey, exp)
	return hmac.Equal([]byte(expected), []byte(sig))
}

// GetLocalPath returns canonicalized absolute path ensuring it stays strictly inside baseDir.
// Returns empty string if path traversal is detected.
func (l *LocalStorageManager) GetLocalPath(storageKey string) string {
	if err := l.validateStorageKey(storageKey); err != nil {
		return ""
	}

	cleanedKey := filepath.Clean(filepath.FromSlash(storageKey))
	fullPath := filepath.Join(l.baseDir, cleanedKey)

	// Ensure the fullPath starts with baseDir + separator
	rel, err := filepath.Rel(l.baseDir, fullPath)
	if err != nil || strings.HasPrefix(rel, "..") || rel == "." && storageKey != "" && storageKey != "." {
		return ""
	}

	return fullPath
}

func (l *LocalStorageManager) validateStorageKey(storageKey string) error {
	if strings.Contains(storageKey, "..") || strings.HasPrefix(storageKey, "/") || strings.HasPrefix(storageKey, "\\") {
		return fmt.Errorf("invalid storage key format")
	}
	return nil
}

func (l *LocalStorageManager) signKey(storageKey string, exp int64) string {
	mac := hmac.New(sha256.New, []byte(l.secretKey))
	mac.Write([]byte(fmt.Sprintf("%s:%d", storageKey, exp)))
	return hex.EncodeToString(mac.Sum(nil))
}
