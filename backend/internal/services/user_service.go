package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"iaas-dashboard/internal/drivers"
	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

type UserService struct {
	db            *sqlx.DB
	driverFactory *drivers.DriverFactory
}

func NewUserService(db *sqlx.DB, driverFactory *drivers.DriverFactory) *UserService {
	return &UserService{
		db:            db,
		driverFactory: driverFactory,
	}
}

func (s *UserService) getProxmoxClusters(ctx context.Context) []models.Cluster {
	var clusters []models.Cluster
	_ = s.db.SelectContext(ctx, &clusters, `SELECT * FROM clusters WHERE type = 'PROXMOX'`)
	return clusters
}

func (s *UserService) ListUsers(ctx context.Context) ([]models.User, error) {
	var users []models.User
	query := `SELECT u.id, u.tenant_id, u.username, u.email, u.full_name, u.role, u.status, u.created_at, u.updated_at,
                     COALESCE(t.name, 'Default Org') as tenant_name
              FROM users u
              LEFT JOIN tenants t ON u.tenant_id = t.id
              ORDER BY u.created_at ASC`

	err := s.db.SelectContext(ctx, &users, query)
	if err != nil {
		return nil, err
	}

	pveClusters := s.getProxmoxClusters(ctx)
	hasProxmox := len(pveClusters) > 0

	for i := range users {
		var vmIDs []uuid.UUID
		err := s.db.SelectContext(ctx, &vmIDs, `SELECT vm_id FROM user_vm_assignments WHERE user_id = $1`, users[i].ID)
		if err == nil {
			users[i].AssignedVMIDs = vmIDs
			users[i].AssignedVMCount = len(vmIDs)
		}
		users[i].ProxmoxUserID = drivers.FormatProxmoxUserID(users[i].Username)
		users[i].ProxmoxSynced = hasProxmox
	}

	return users, nil
}

func (s *UserService) GetUserVMs(ctx context.Context, userID uuid.UUID) ([]models.VirtualMachine, error) {
	var vms []models.VirtualMachine
	query := `SELECT vm.* FROM virtual_machines vm
	          INNER JOIN user_vm_assignments uva ON uva.vm_id = vm.id
	          WHERE uva.user_id = $1
	          ORDER BY vm.name ASC`
	if err := s.db.SelectContext(ctx, &vms, query, userID); err != nil {
		return []models.VirtualMachine{}, err
	}
	if vms == nil {
		vms = []models.VirtualMachine{}
	}
	return vms, nil
}

func (s *UserService) CreateUser(ctx context.Context, req models.CreateUserRequest) (*models.User, error) {
	// Check if username or email already exists
	var count int
	_ = s.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM users WHERE username = $1 OR email = $2`, req.Username, req.Email)
	if count > 0 {
		return nil, errors.New("username or email is already registered")
	}

	// Resolve tenant ID
	tenantID := uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11") // default tenant
	if req.TenantID != nil && *req.TenantID != uuid.Nil {
		tenantID = *req.TenantID
	} else {
		var firstTenantID uuid.UUID
		if err := s.db.GetContext(ctx, &firstTenantID, `SELECT id FROM tenants LIMIT 1`); err == nil && firstTenantID != uuid.Nil {
			tenantID = firstTenantID
		}
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	newUser := models.User{
		ID:            uuid.New(),
		TenantID:      tenantID,
		Username:      req.Username,
		Email:         req.Email,
		PasswordHash:  string(hashedPassword),
		FullName:      req.FullName,
		Role:          req.Role,
		Status:        "ACTIVE",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
		ProxmoxUserID: drivers.FormatProxmoxUserID(req.Username),
	}

	insertQuery := `INSERT INTO users (id, tenant_id, username, email, password_hash, full_name, role, status, created_at, updated_at)
                    VALUES (:id, :tenant_id, :username, :email, :password_hash, :full_name, :role, :status, :created_at, :updated_at)`

	_, err = s.db.NamedExecContext(ctx, insertQuery, newUser)
	if err != nil {
		return nil, fmt.Errorf("failed to insert user record: %w", err)
	}

	// Sync new user account + password to all Proxmox clusters
	pveClusters := s.getProxmoxClusters(ctx)
	var syncErrors []string
	syncedCount := 0
	if s.driverFactory != nil {
		for _, cl := range pveClusters {
			drv := s.driverFactory.GetDriverForCluster(&cl)
			if err := drv.SyncUser(ctx, &cl, newUser, req.Password); err != nil {
				log.Printf("[UserService] Proxmox user sync warning on cluster %s: %v", cl.ID, err)
				syncErrors = append(syncErrors, fmt.Sprintf("%s: %v", cl.Name, err))
			} else {
				syncedCount++
			}
		}
	}

	// Assign VMs if provided (this also syncs Proxmox /vms/<vmid> ACLs)
	if len(req.AssignedVMs) > 0 {
		_ = s.AssignVMs(ctx, newUser.ID, req.AssignedVMs)
		newUser.AssignedVMIDs = req.AssignedVMs
		newUser.AssignedVMCount = len(req.AssignedVMs)
	}

	if syncedCount > 0 && len(syncErrors) == 0 {
		newUser.ProxmoxSynced = true
		newUser.ProxmoxSyncMsg = fmt.Sprintf("Synced %s to %d Proxmox cluster(s)", newUser.ProxmoxUserID, syncedCount)
	} else if len(syncErrors) > 0 {
		newUser.ProxmoxSyncMsg = "Proxmox sync note: " + strings.Join(syncErrors, "; ")
	}

	return &newUser, nil
}

func (s *UserService) AssignVMs(ctx context.Context, userID uuid.UUID, vmIDs []uuid.UUID) error {
	var user models.User
	if err := s.db.GetContext(ctx, &user, `SELECT * FROM users WHERE id = $1`, userID); err != nil {
		return errors.New("user not found")
	}

	// 1. Fetch previously assigned VMs before modifying DB so we can revoke removed Proxmox ACLs
	prevVMs, _ := s.GetUserVMs(ctx, userID)

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Clear previous assignments
	_, err = tx.ExecContext(ctx, `DELETE FROM user_vm_assignments WHERE user_id = $1`, userID)
	if err != nil {
		return err
	}

	// Insert new assignments
	for _, vmID := range vmIDs {
		_, err = tx.ExecContext(ctx, `INSERT INTO user_vm_assignments (user_id, vm_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, vmID)
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	// 2. Fetch newly assigned VMs and synchronize ACLs (/vms/<vmid> -> PVEVMUser) on Proxmox clusters
	newVMs, _ := s.GetUserVMs(ctx, userID)
	s.syncProxmoxVMAssignments(ctx, user, prevVMs, newVMs)

	return nil
}

func (s *UserService) syncProxmoxVMAssignments(ctx context.Context, user models.User, prevVMs, newVMs []models.VirtualMachine) {
	if s.driverFactory == nil {
		return
	}

	pveClusters := s.getProxmoxClusters(ctx)
	if len(pveClusters) == 0 {
		return
	}

	// Group old and new VMIDs by cluster ID
	newByCluster := make(map[string]map[int]bool)
	for _, vm := range newVMs {
		if vm.HypervisorType == models.HypervisorProxmox && vm.VMID > 0 {
			if newByCluster[vm.ClusterID] == nil {
				newByCluster[vm.ClusterID] = make(map[int]bool)
			}
			newByCluster[vm.ClusterID][vm.VMID] = true
		}
	}

	prevByCluster := make(map[string]map[int]bool)
	for _, vm := range prevVMs {
		if vm.HypervisorType == models.HypervisorProxmox && vm.VMID > 0 {
			if prevByCluster[vm.ClusterID] == nil {
				prevByCluster[vm.ClusterID] = make(map[int]bool)
			}
			prevByCluster[vm.ClusterID][vm.VMID] = true
		}
	}

	for _, cl := range pveClusters {
		var assignIDs []int
		var revokeIDs []int

		for vmid := range newByCluster[cl.ID] {
			assignIDs = append(assignIDs, vmid)
		}
		for vmid := range prevByCluster[cl.ID] {
			if !newByCluster[cl.ID][vmid] {
				revokeIDs = append(revokeIDs, vmid)
			}
		}

		if len(assignIDs) == 0 && len(revokeIDs) == 0 {
			continue
		}

		drv := s.driverFactory.GetDriverForCluster(&cl)
		if err := drv.SyncUserVMAccess(ctx, &cl, user, assignIDs, revokeIDs); err != nil {
			log.Printf("[UserService] Proxmox ACL sync note for user %s on cluster %s: %v", user.Username, cl.ID, err)
		}
	}
}

func (s *UserService) SyncUserToProxmox(ctx context.Context, userID uuid.UUID, password string) (string, error) {
	var user models.User
	if err := s.db.GetContext(ctx, &user, `SELECT * FROM users WHERE id = $1`, userID); err != nil {
		return "", errors.New("user not found")
	}

	pveClusters := s.getProxmoxClusters(ctx)
	if len(pveClusters) == 0 {
		return "", errors.New("no Proxmox VE cluster is currently registered")
	}

	assignedVMs, _ := s.GetUserVMs(ctx, userID)
	pveUserID := drivers.FormatProxmoxUserID(user.Username)

	var errs []string
	syncedClusters := 0
	syncedVMs := 0

	for _, cl := range pveClusters {
		drv := s.driverFactory.GetDriverForCluster(&cl)
		if err := drv.SyncUser(ctx, &cl, user, password); err != nil {
			errs = append(errs, fmt.Sprintf("%s (user): %v", cl.Name, err))
			continue
		}
		syncedClusters++

		var assignIDs []int
		for _, vm := range assignedVMs {
			if vm.ClusterID == cl.ID && vm.HypervisorType == models.HypervisorProxmox && vm.VMID > 0 {
				assignIDs = append(assignIDs, vm.VMID)
			}
		}

		if len(assignIDs) > 0 {
			if err := drv.SyncUserVMAccess(ctx, &cl, user, assignIDs, nil); err != nil {
				errs = append(errs, fmt.Sprintf("%s (ACL): %v", cl.Name, err))
			} else {
				syncedVMs += len(assignIDs)
			}
		}
	}

	if len(errs) > 0 && syncedClusters == 0 {
		return "", fmt.Errorf("failed to sync %s to Proxmox: %s", pveUserID, strings.Join(errs, "; "))
	}

	msg := fmt.Sprintf("Synced '%s' to %d Proxmox cluster(s) with %d VM ACL(s)", pveUserID, syncedClusters, syncedVMs)
	if len(errs) > 0 {
		msg += " (warnings: " + strings.Join(errs, "; ") + ")"
	}
	return msg, nil
}

func (s *UserService) DeleteUser(ctx context.Context, userID, currentUserID uuid.UUID) error {
	if userID == currentUserID {
		return errors.New("cannot delete your own active session")
	}

	var user models.User
	if err := s.db.GetContext(ctx, &user, `SELECT * FROM users WHERE id = $1`, userID); err != nil {
		return errors.New("user not found")
	}

	if user.Username == "admin" {
		return errors.New("cannot delete the root system administrator")
	}

	// Revoke & remove user from all Proxmox clusters
	if s.driverFactory != nil {
		for _, cl := range s.getProxmoxClusters(ctx) {
			drv := s.driverFactory.GetDriverForCluster(&cl)
			if err := drv.DeleteHypervisorUser(ctx, &cl, user.Username); err != nil {
				log.Printf("[UserService] Note deleting Proxmox user %s on %s: %v", user.Username, cl.ID, err)
			}
		}
	}

	_, err := s.db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	return err
}
