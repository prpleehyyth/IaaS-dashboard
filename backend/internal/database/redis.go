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

// ValidateTicket verifies and atomically consumes the one-time ticket
func (r *RedisClient) ValidateTicket(ctx context.Context, ticket string) (string, error) {
	key := fmt.Sprintf("vnc_ticket:%s", ticket)
	vmID, err := r.Client.GetDel(ctx, key).Result()
	if err != nil {
		// Fallback for older Redis versions if GetDel is unsupported
		vmID, err = r.Client.Get(ctx, key).Result()
		if err != nil {
			return "", err
		}
		r.Client.Del(ctx, key)
	}
	return vmID, nil
}

// RevokeUserTokens marks a user ID as revoked in Redis for the duration of active JWT lifetime
func (r *RedisClient) RevokeUserTokens(ctx context.Context, userID string, ttl time.Duration) error {
	key := fmt.Sprintf("revoked_user:%s", userID)
	return r.Client.Set(ctx, key, "revoked", ttl).Err()
}

// IsUserRevoked checks whether a user's tokens have been revoked
func (r *RedisClient) IsUserRevoked(ctx context.Context, userID string) bool {
	if r == nil || r.Client == nil {
		return false
	}
	key := fmt.Sprintf("revoked_user:%s", userID)
	val, err := r.Client.Exists(ctx, key).Result()
	return err == nil && val > 0
}
