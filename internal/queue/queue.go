package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/li-pdf/li-pdf/internal/models"
	"github.com/redis/go-redis/v9"
)

type TaskPayload struct {
	JobID           uuid.UUID              `json:"job_id"`
	UploadID        uuid.UUID              `json:"upload_id"`
	Operation       string                 `json:"operation"`
	Parameters      map[string]any         `json:"parameters"`
	ResourceProfile models.ResourceProfile `json:"resource_profile"`
	AssignedQueue   string                 `json:"assigned_queue"`
	InputStorageKey string                 `json:"input_storage_key"`
	OriginalName    string                 `json:"original_name"`
	MimeType        string                 `json:"mime_type"`
}

type JobQueue interface {
	Enqueue(ctx context.Context, queueName string, task *TaskPayload) error
	Dequeue(ctx context.Context, queueNames []string, timeout time.Duration) (*TaskPayload, error)
	PublishProgress(ctx context.Context, jobID uuid.UUID, percent int, step string) error
	SubscribeProgress(ctx context.Context, jobID uuid.UUID) (<-chan string, func(), error)
}

type RedisQueue struct {
	client *redis.Client
}

func NewRedisQueue(redisURL string) (*RedisQueue, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis url: %w", err)
	}
	rdb := redis.NewClient(opt)
	return &RedisQueue{client: rdb}, nil
}

func (q *RedisQueue) Enqueue(ctx context.Context, queueName string, task *TaskPayload) error {
	data, err := json.Marshal(task)
	if err != nil {
		return err
	}
	return q.client.LPush(ctx, queueName, data).Err()
}

func (q *RedisQueue) Dequeue(ctx context.Context, queueNames []string, timeout time.Duration) (*TaskPayload, error) {
	res, err := q.client.BRPop(ctx, timeout, queueNames...).Result()
	if err != nil {
		return nil, err
	}
	if len(res) < 2 {
		return nil, fmt.Errorf("empty dequeue result")
	}

	var task TaskPayload
	if err := json.Unmarshal([]byte(res[1]), &task); err != nil {
		return nil, fmt.Errorf("failed to unmarshal task: %w", err)
	}
	return &task, nil
}

func (q *RedisQueue) PublishProgress(ctx context.Context, jobID uuid.UUID, percent int, step string) error {
	msg := map[string]any{
		"job_id":           jobID.String(),
		"progress_percent": percent,
		"step":             step,
		"timestamp":        time.Now().UTC().Format(time.RFC3339),
	}
	data, _ := json.Marshal(msg)
	channel := fmt.Sprintf("job_events:%s", jobID.String())
	return q.client.Publish(ctx, channel, data).Err()
}

func (q *RedisQueue) SubscribeProgress(ctx context.Context, jobID uuid.UUID) (<-chan string, func(), error) {
	channel := fmt.Sprintf("job_events:%s", jobID.String())
	pubsub := q.client.Subscribe(ctx, channel)
	ch := make(chan string, 100)

	go func() {
		defer close(ch)
		for msg := range pubsub.Channel() {
			ch <- msg.Payload
		}
	}()

	cleanup := func() {
		_ = pubsub.Close()
	}

	return ch, cleanup, nil
}

// MemoryQueue provides an in-memory queue fallback for tests and standalone mode.
type MemoryQueue struct {
	queues    map[string]chan *TaskPayload
	listeners map[string][]chan string
}

func NewMemoryQueue() *MemoryQueue {
	return &MemoryQueue{
		queues:    make(map[string]chan *TaskPayload),
		listeners: make(map[string][]chan string),
	}
}

func (m *MemoryQueue) getQueue(name string) chan *TaskPayload {
	if ch, ok := m.queues[name]; ok {
		return ch
	}
	ch := make(chan *TaskPayload, 1000)
	m.queues[name] = ch
	return ch
}

func (m *MemoryQueue) Enqueue(ctx context.Context, queueName string, task *TaskPayload) error {
	ch := m.getQueue(queueName)
	select {
	case ch <- task:
		return nil
	default:
		return fmt.Errorf("queue %s is full", queueName)
	}
}

func (m *MemoryQueue) Dequeue(ctx context.Context, queueNames []string, timeout time.Duration) (*TaskPayload, error) {
	cases := make([]chan *TaskPayload, len(queueNames))
	for i, qn := range queueNames {
		cases[i] = m.getQueue(qn)
	}

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for {
		for _, ch := range cases {
			select {
			case task := <-ch:
				return task, nil
			default:
			}
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-timer.C:
			return nil, fmt.Errorf("dequeue timeout")
		case <-time.After(50 * time.Millisecond):
		}
	}
}

func (m *MemoryQueue) PublishProgress(ctx context.Context, jobID uuid.UUID, percent int, step string) error {
	msg := map[string]any{
		"job_id":           jobID.String(),
		"progress_percent": percent,
		"step":             step,
		"timestamp":        time.Now().UTC().Format(time.RFC3339),
	}
	data, _ := json.Marshal(msg)
	key := jobID.String()
	if list, ok := m.listeners[key]; ok {
		for _, ch := range list {
			select {
			case ch <- string(data):
			default:
			}
		}
	}
	return nil
}

func (m *MemoryQueue) SubscribeProgress(ctx context.Context, jobID uuid.UUID) (<-chan string, func(), error) {
	key := jobID.String()
	ch := make(chan string, 100)
	m.listeners[key] = append(m.listeners[key], ch)

	cleanup := func() {
		// cleanup channel
	}

	return ch, cleanup, nil
}
