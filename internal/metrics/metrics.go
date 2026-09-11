package metrics

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

type MetricsCollector struct {
	startTime time.Time

	// Counters and Gauges
	mu               sync.RWMutex
	jobsTotal        map[string]*int64    // key: op|status|profile
	jobDurations     map[string][]float64 // key: op|profile -> durations in seconds
	activeJobs       map[string]*int64    // key: queue
	purgedFilesTotal int64
}

var DefaultMetrics = NewMetricsCollector()

func NewMetricsCollector() *MetricsCollector {
	return &MetricsCollector{
		startTime:    time.Now(),
		jobsTotal:    make(map[string]*int64),
		jobDurations: make(map[string][]float64),
		activeJobs:   make(map[string]*int64),
	}
}

func (m *MetricsCollector) RecordJobStart(queueName string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	ptr, ok := m.activeJobs[queueName]
	if !ok {
		val := int64(0)
		ptr = &val
		m.activeJobs[queueName] = ptr
	}
	atomic.AddInt64(ptr, 1)
}

func (m *MetricsCollector) RecordJobComplete(operation string, status string, profile string, queueName string, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Decrement active jobs for queue
	if ptr, ok := m.activeJobs[queueName]; ok {
		atomic.AddInt64(ptr, -1)
	}

	// Increment total jobs counter
	counterKey := fmt.Sprintf("%s|%s|%s", operation, status, profile)
	ptr, ok := m.jobsTotal[counterKey]
	if !ok {
		val := int64(0)
		ptr = &val
		m.jobsTotal[counterKey] = ptr
	}
	atomic.AddInt64(ptr, 1)

	// Record duration
	durKey := fmt.Sprintf("%s|%s", operation, profile)
	durSec := duration.Seconds()
	m.jobDurations[durKey] = append(m.jobDurations[durKey], durSec)
	// Keep last 100 entries per operation for memory bounds
	if len(m.jobDurations[durKey]) > 100 {
		m.jobDurations[durKey] = m.jobDurations[durKey][1:]
	}
}

func (m *MetricsCollector) RecordPurgedFiles(count int64) {
	atomic.AddInt64(&m.purgedFilesTotal, count)
}

// Handler returns a Gin HandlerFunc that formats metrics in standard Prometheus exposition format.
func (m *MetricsCollector) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		m.mu.RLock()
		defer m.mu.RUnlock()

		var sb strings.Builder

		// Help and Type headers
		sb.WriteString("# HELP lipdf_uptime_seconds Total seconds since API server started\n")
		sb.WriteString("# TYPE lipdf_uptime_seconds gauge\n")
		sb.WriteString(fmt.Sprintf("lipdf_uptime_seconds %.2f\n\n", time.Since(m.startTime).Seconds()))

		sb.WriteString("# HELP lipdf_storage_purged_files_total Total expired files removed by storage purger\n")
		sb.WriteString("# TYPE lipdf_storage_purged_files_total counter\n")
		sb.WriteString(fmt.Sprintf("lipdf_storage_purged_files_total %d\n\n", atomic.LoadInt64(&m.purgedFilesTotal)))

		sb.WriteString("# HELP lipdf_active_jobs Current in-flight jobs by queue\n")
		sb.WriteString("# TYPE lipdf_active_jobs gauge\n")
		for q, ptr := range m.activeJobs {
			val := atomic.LoadInt64(ptr)
			if val < 0 {
				val = 0
			}
			sb.WriteString(fmt.Sprintf("lipdf_active_jobs{queue=\"%s\"} %d\n", q, val))
		}
		sb.WriteString("\n")

		sb.WriteString("# HELP lipdf_jobs_total Total processed jobs count\n")
		sb.WriteString("# TYPE lipdf_jobs_total counter\n")
		for key, ptr := range m.jobsTotal {
			parts := strings.Split(key, "|")
			if len(parts) == 3 {
				op, status, profile := parts[0], parts[1], parts[2]
				sb.WriteString(fmt.Sprintf("lipdf_jobs_total{operation=\"%s\",status=\"%s\",resource_profile=\"%s\"} %d\n", op, status, profile, atomic.LoadInt64(ptr)))
			}
		}
		sb.WriteString("\n")

		sb.WriteString("# HELP lipdf_job_duration_seconds Average processing duration in seconds\n")
		sb.WriteString("# TYPE lipdf_job_duration_seconds gauge\n")
		for key, durs := range m.jobDurations {
			parts := strings.Split(key, "|")
			if len(parts) == 2 && len(durs) > 0 {
				op, profile := parts[0], parts[1]
				sum := 0.0
				for _, d := range durs {
					sum += d
				}
				avg := sum / float64(len(durs))
				sb.WriteString(fmt.Sprintf("lipdf_job_duration_seconds{operation=\"%s\",resource_profile=\"%s\"} %.4f\n", op, profile, avg))
			}
		}

		c.Data(http.StatusOK, "text/plain; version=0.0.4; charset=utf-8", []byte(sb.String()))
	}
}
