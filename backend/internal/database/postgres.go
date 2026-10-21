package database

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

type DBOrTx interface {
	sqlx.ExtContext
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func ConnectPostgres(dsn string) (*sqlx.DB, error) {
	var db *sqlx.DB
	var err error

	// Retry loop for Docker container startup synchronization
	for attempts := 1; attempts <= 15; attempts++ {
		db, err = sqlx.Connect("postgres", dsn)
		if err == nil {
			err = db.Ping()
			if err == nil {
				log.Println("Successfully connected to PostgreSQL database")
				db.SetMaxOpenConns(25)
				db.SetMaxIdleConns(10)
				db.SetConnMaxLifetime(5 * time.Minute)
				return db, nil
			}
		}

		log.Printf("Waiting for PostgreSQL to be ready (attempt %d/15)... %v", attempts, err)
		time.Sleep(2 * time.Second)
	}

	return nil, err
}
