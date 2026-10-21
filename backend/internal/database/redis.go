package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	Client *redis.Client
}

func ConnectRedis(addr, password string) (*RedisClient, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var err error
	for attempts := 1; attempts <= 10; attempts++ {
		err = rdb.Ping(ctx).Err()
		if err == nil {
			log.Println("Successfully connected to Redis")
			return &RedisClient{Client: rdb}, nil
		}
		log.Printf("Waiting for Redis to be ready (attempt %d/10)... %v", attempts, err)
		time.Sleep(2 * time.Second)
	}

	return nil, err
}

// AcquireLock implements a distributed lock using Redis SETNX with TTL
func (r *RedisClient) AcquireLock(ctx context.Context, lockKey string, ttl time.Duration) (bool, error) {
	key := fmt.Sprintf("lock:%s", lockKey)
	return r.Client.SetNX(ctx, key, "locked", ttl).Result()
}

// ReleaseLock removes the distributed lock
func (r *RedisClient) ReleaseLock(ctx context.Context, lockKey string) error {
	key := fmt.Sprintf("lock:%s", lockKey)
	return r.Client.Del(ctx, key).Err()
}

// SetTicket stores ephemeral console authorization ticket
func (r *RedisClient) SetTicket(ctx context.Context, ticket string, vmID string, ttl time.Duration) error {
	key := fmt.Sprintf("vnc_ticket:%s", ticket)
	return r.Client.Set(ctx, key, vmID, ttl).Err()
}

// ValidateTicket verifies and consumes the ticket
func (r *RedisClient) ValidateTicket(ctx context.Context, ticket string) (string, error) {
	key := fmt.Sprintf("vnc_ticket:%s", ticket)
	vmID, err := r.Client.Get(ctx, key).Result()
	if err != nil {
		return "", err
	}
	// Ticket is single-use: expire after 10s or delete
	r.Client.Expire(ctx, key, 10*time.Second)
	return vmID, nil
}
