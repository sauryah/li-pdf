package storage

import (
	"context"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLocalStorageManager_PathTraversalSecurity(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "lipdf_storage_test_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	secret := "test-secret-key-32-chars-long-1234"
	sm, err := NewLocalStorageManager(tempDir, "http://localhost:8080", secret)
	if err != nil {
		t.Fatalf("Failed to create LocalStorageManager: %v", err)
	}

	// Malicious keys attempting directory traversal
	maliciousKeys := []string{
		"../secret.txt",
		"../../etc/passwd",
		"uploads/../../windows/system32/cmd.exe",
		`..\..\boot.ini`,
		"/absolute/path/file.pdf",
		`\windows\file.pdf`,
	}

	for _, key := range maliciousKeys {
		_, err := sm.GetLocalPath(key)
		if err == nil {
			t.Errorf("Expected path traversal error for key %q, but got none", key)
		}
	}
}

func TestLocalStorageManager_SignedURLVerification(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "lipdf_storage_test_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	secret := "secure-test-secret-123456789012345"
	sm, err := NewLocalStorageManager(tempDir, "http://localhost:8080", secret)
	if err != nil {
		t.Fatalf("Failed to create LocalStorageManager: %v", err)
	}

	key := "uploads/test-job/input.pdf"
	signedURL, err := sm.GetDownloadURL(context.Background(), key, 10*time.Minute)
	if err != nil {
		t.Fatalf("Failed to get download URL: %v", err)
	}

	u, err := url.Parse(signedURL)
	if err != nil {
		t.Fatalf("Failed to parse signed URL: %v", err)
	}

	token := u.Query().Get("token")
	expStr := u.Query().Get("exp")
	if token == "" || expStr == "" {
		t.Fatalf("Signed URL missing token or exp: %s", signedURL)
	}

	// Valid token check
	if err := sm.VerifySignedToken(key, token, expStr); err != nil {
		t.Errorf("VerifySignedToken failed for valid signature: %v", err)
	}

	// Tampered token check
	if err := sm.VerifySignedToken(key, "invalid_token_xyz", expStr); err == nil {
		t.Errorf("Expected signature mismatch for invalid token, got nil")
	}

	// Expired token check
	pastExp := time.Now().Add(-10 * time.Minute).Unix()
	pastToken := sm.generateSignature(key, pastExp)
	if err := sm.VerifySignedToken(key, pastToken, time.Unix(pastExp, 0).Format(time.RFC3339)); err == nil {
		t.Errorf("Expected expiration error for past token, got nil")
	}
}

func TestLocalStorageManager_UploadAndDownloadStreaming(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "lipdf_storage_test_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	sm, err := NewLocalStorageManager(tempDir, "http://localhost:8080", "secret-test-key")
	if err != nil {
		t.Fatalf("Failed to create LocalStorageManager: %v", err)
	}

	// Create test file
	srcPath := filepath.Join(tempDir, "test_source.txt")
	testContent := "Hello li-pdf streaming storage test!"
	if err := os.WriteFile(srcPath, []byte(testContent), 0644); err != nil {
		t.Fatalf("Failed to write test source: %v", err)
	}

	storageKey := "processed-outputs/job-123/test_out.txt"
	if err := sm.UploadFile(context.Background(), srcPath, storageKey, "text/plain"); err != nil {
		t.Fatalf("UploadFile failed: %v", err)
	}

	dstPath := filepath.Join(tempDir, "downloaded.txt")
	if err := sm.DownloadFile(context.Background(), storageKey, dstPath); err != nil {
		t.Fatalf("DownloadFile failed: %v", err)
	}

	downloaded, err := os.ReadFile(dstPath)
	if err != nil {
		t.Fatalf("Failed to read downloaded file: %v", err)
	}

	if string(downloaded) != testContent {
		t.Errorf("Content mismatch: got %q, want %q", string(downloaded), testContent)
	}
}
