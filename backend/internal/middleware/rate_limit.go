package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type clientAttempt struct {
	count     int
	lastReset time.Time
}

type LoginRateLimiter struct {
	mu       sync.Mutex
	attempts map[string]*clientAttempt
	limit    int
	window   time.Duration
}

func NewLoginRateLimiter(limit int, window time.Duration) *LoginRateLimiter {
	limiter := &LoginRateLimiter{
		attempts: make(map[string]*clientAttempt),
		limit:    limit,
		window:   window,
	}

	// Periodic cleanup of stale IP records every 10 minutes
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		for range ticker.C {
			limiter.mu.Lock()
			now := time.Now()
			for ip, att := range limiter.attempts {
				if now.Sub(att.lastReset) > limiter.window*2 {
					delete(limiter.attempts, ip)
				}
			}
			limiter.mu.Unlock()
		}
	}()

	return limiter
}

func (l *LoginRateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		now := time.Now()

		l.mu.Lock()
		att, exists := l.attempts[clientIP]
		if !exists || now.Sub(att.lastReset) > l.window {
			l.attempts[clientIP] = &clientAttempt{
				count:     1,
				lastReset: now,
			}
			l.mu.Unlock()
			c.Next()
			return
		}

		if att.count >= l.limit {
			l.mu.Unlock()
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Terlalu banyak percobaan login. Silakan tunggu beberapa saat sebelum mencoba kembali.",
			})
			c.Abort()
			return
		}

		att.count++
		l.mu.Unlock()

		c.Next()
	}
}
