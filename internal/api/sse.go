package api

import (
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/li-pdf/li-pdf/internal/queue"
)

type SSEHub struct {
	queue queue.JobQueue
	mu    sync.RWMutex
}

func NewSSEHub(q queue.JobQueue) *SSEHub {
	return &SSEHub{queue: q}
}

func (h *SSEHub) StreamJobEvents(c *gin.Context) {
	jobIDStr := c.Param("id")
	jobID, err := uuid.Parse(jobIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid job id"})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

	eventsCh, cleanup, err := h.queue.SubscribeProgress(c.Request.Context(), jobID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to subscribe to events"})
		return
	}
	defer cleanup()

	// Initial ping
	fmt.Fprintf(c.Writer, "event: connected\ndata: {\"job_id\": \"%s\", \"status\": \"connected\"}\n\n", jobIDStr)
	c.Writer.Flush()

	c.Stream(func(w io.Writer) bool {
		select {
		case <-c.Request.Context().Done():
			return false
		case msg, ok := <-eventsCh:
			if !ok {
				return false
			}
			fmt.Fprintf(w, "event: progress\ndata: %s\n\n", msg)
			return true
		}
	})
}
