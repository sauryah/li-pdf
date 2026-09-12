package queue

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestMemoryQueue_EnqueueDequeue(t *testing.T) {
	q := NewMemoryQueue()
	ctx := context.Background()

	task := &TaskPayload{
		JobID:           uuid.New(),
		Operation:       "pdf_compress",
		InputStorageKey: "uploads/test.pdf",
		OriginalName:    "test.pdf",
		AssignedQueue:   "queue_pdf_std",
	}

	if err := q.Enqueue(ctx, "queue_pdf_std", task); err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	dequeued, err := q.Dequeue(ctx, []string{"queue_pdf_std"}, 1*time.Second)
	if err != nil {
		t.Fatalf("Dequeue failed: %v", err)
	}

	if dequeued.JobID != task.JobID {
		t.Errorf("JobID mismatch: got %v, want %v", dequeued.JobID, task.JobID)
	}
}

func TestMemoryQueue_ConcurrentAccess(t *testing.T) {
	q := NewMemoryQueue()
	ctx := context.Background()
	var wg sync.WaitGroup

	numJobs := 50
	for i := 0; i < numJobs; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			task := &TaskPayload{
				JobID:         uuid.New(),
				Operation:     "image_compress",
				AssignedQueue: "queue_image_fast",
			}
			_ = q.Enqueue(ctx, "queue_image_fast", task)
		}(i)
	}

	wg.Wait()

	// Dequeue all
	received := 0
	for i := 0; i < numJobs; i++ {
		task, err := q.Dequeue(ctx, []string{"queue_image_fast"}, 100*time.Millisecond)
		if err == nil && task != nil {
			received++
		}
	}

	if received != numJobs {
		t.Errorf("Expected to dequeue %d jobs, got %d", numJobs, received)
	}
}

func TestMemoryQueue_SubscribeProgressCleanup(t *testing.T) {
	q := NewMemoryQueue()
	jobID := uuid.New()

	ch, cleanup := q.SubscribeProgress(jobID)
	if ch == nil {
		t.Fatal("Expected progress channel, got nil")
	}

	// Publish progress
	_ = q.PublishProgress(context.Background(), jobID, 50, "Processing")

	select {
	case event := <-ch:
		if event.Progress != 50 || event.CurrentStep != "Processing" {
			t.Errorf("Unexpected event payload: %+v", event)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("Timed out waiting for progress event")
	}

	// Unsubscribe cleanup
	cleanup()

	// Verify subscriber list is cleaned up
	mq := q.(*MemoryQueue)
	mq.mu.RLock()
	subs := mq.subscribers[jobID]
	mq.mu.RUnlock()

	if len(subs) != 0 {
		t.Errorf("Expected 0 subscribers after cleanup, got %d", len(subs))
	}
}
