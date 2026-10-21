package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"iaas-dashboard/internal/config"
	"iaas-dashboard/internal/database"
	"iaas-dashboard/internal/drivers"
	"iaas-dashboard/internal/handlers"
	"iaas-dashboard/internal/middleware"
	"iaas-dashboard/internal/models"
	"iaas-dashboard/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	log.Println("Starting Multi-Tenant Private Cloud IaaS Backend...")

	// 1. Load Configuration
	cfg := config.Load()

	// 2. Database & Cache Connections
	db, err := database.ConnectPostgres(cfg.PostgresURL)
	if err != nil {
		log.Fatalf("Fatal: Unable to connect to PostgreSQL: %v", err)
	}
	defer db.Close()

	redisClient, err := database.ConnectRedis(cfg.RedisAddr, cfg.RedisPassword)
	if err != nil {
		log.Fatalf("Fatal: Unable to connect to Redis: %v", err)
	}

	// 3. Driver & Service Factories
	driverFactory := drivers.NewDriverFactory(cfg)

	authService := services.NewAuthService(db, cfg.JWTSecret)
	clusterService := services.NewClusterService(db, redisClient, driverFactory)
	vmService := services.NewVMService(db, redisClient, driverFactory)
	consoleService := services.NewConsoleService(db, redisClient, driverFactory, vmService)
	meteringService := services.NewMeteringService(db)
	userService := services.NewUserService(db)

	// 4. Handlers
	authHandler := handlers.NewAuthHandler(authService)
	clusterHandler := handlers.NewClusterHandler(clusterService)
	vmHandler := handlers.NewVMHandler(vmService)
	consoleHandler := handlers.NewConsoleHandler(consoleService, vmService, redisClient)
	tenantHandler := handlers.NewTenantHandler(db)
	meteringHandler := handlers.NewMeteringHandler(meteringService)
	userHandler := handlers.NewUserHandler(userService)

	// 5. Background Metering Worker (records periodic usage snapshots for billing readiness)
	go startMeteringWorker(db)

	// 6. Router Setup
	r := gin.Default()

	// CORS configuration
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Public Routes
	r.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "IaaS Multi-Tenant Cloud Controller",
			"time":    time.Now().Format(time.RFC3339),
			"clusters_managed": gin.H{
				"vmware_clusters":  3,
				"proxmox_clusters": 1,
				"total_nodes":      12,
			},
		})
	})

	r.POST("/api/v1/auth/login", authHandler.Login)
	r.GET("/api/v1/vms/:id/console/ws", consoleHandler.HandleConsoleWebSocket)

	// Authenticated Routes
	api := r.Group("/api/v1")
	api.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		api.GET("/auth/me", authHandler.GetCurrentUser)

		// Dashboard & Clusters (Admin & Operator)
		api.GET("/dashboard/summary", clusterHandler.GetDashboardSummary)
		api.GET("/clusters", clusterHandler.GetAllClusters)
		api.GET("/clusters/:id", clusterHandler.GetCluster)

		// Virtual Machines (Admin & Operator)
		api.GET("/vms", vmHandler.ListVMs)
		api.GET("/vms/:id", vmHandler.GetVM)
		api.POST("/vms/:id/action", vmHandler.ExecutePowerAction) // Start, Stop, Restart
		api.POST("/vms/:id/console", consoleHandler.RequestConsoleSession)

		// Telemetry & Metering (Pre-wired for billing)
		api.GET("/metering/summary", meteringHandler.GetMeteringSummary)

		// Admin-Only Routes
		adminOnly := api.Group("")
		adminOnly.Use(middleware.RequireRole(models.RoleAdmin))
		{
			// VM Lifecycle Management (Admin Only)
			adminOnly.POST("/vms", vmHandler.CreateVM)
			adminOnly.PUT("/vms/:id", vmHandler.UpdateVM)
			adminOnly.DELETE("/vms/:id", vmHandler.DeleteVM)

			// Tenant & Quota Management (Admin Only)
			adminOnly.GET("/tenants", tenantHandler.ListTenants)
			adminOnly.PUT("/tenants/:id/quota", tenantHandler.UpdateQuota)

			// User Management & VM Access Assignment (Admin Only)
			adminOnly.GET("/users", userHandler.ListUsers)
			adminOnly.POST("/users", userHandler.CreateUser)
			adminOnly.PUT("/users/:id/vms", userHandler.AssignVMs)
			adminOnly.DELETE("/users/:id", userHandler.DeleteUser)
		}
	}

	log.Printf("IaaS Cloud API listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func startMeteringWorker(db database.DBOrTx) {
	ticker := time.NewTicker(45 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		_, err := db.ExecContext(ctx, `
            INSERT INTO resource_metering_samples (tenant_id, vm_id, cpu_cores, ram_mb, disk_gb, status)
            SELECT tenant_id, id, cpu_cores, ram_mb, disk_gb, status 
            FROM virtual_machines 
            WHERE status = 'RUNNING'
        `)
		if err != nil {
			log.Printf("Metering worker note: %v", err)
		}
		cancel()
	}
}
