package handlers

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"

	"iaas-dashboard/internal/database"
	"iaas-dashboard/internal/middleware"
	"iaas-dashboard/internal/models"
	"iaas-dashboard/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin == "" {
			return true // Non-browser clients
		}
		parsedOrigin, err := url.Parse(origin)
		if err != nil || (parsedOrigin.Scheme != "http" && parsedOrigin.Scheme != "https") {
			log.Printf("[Security] Rejected malformed WebSocket Origin: %s", origin)
			return false
		}
		originHost := strings.ToLower(parsedOrigin.Hostname())
		reqHost := strings.ToLower(r.Host)
		if h, _, err := net.SplitHostPort(reqHost); err == nil {
			reqHost = h
		}

		if originHost == reqHost ||
			originHost == "localhost" ||
			originHost == "127.0.0.1" ||
			originHost == "::1" ||
			originHost == "pal.co.id" ||
			strings.HasSuffix(originHost, ".pal.co.id") {
			return true
		}

		// Also allow RFC1918 private LAN origins when accessed over internal network
		if ip := net.ParseIP(originHost); ip != nil && ip.IsPrivate() {
			return true
		}

		log.Printf("[Security] Rejected cross-origin WebSocket connection from: %s (Host: %s)", origin, r.Host)
		return false
	},
}

type ConsoleHandler struct {
	consoleService *services.ConsoleService
	vmService      *services.VMService
	redis          *database.RedisClient
	jwtSecret      string
}

func NewConsoleHandler(consoleService *services.ConsoleService, vmService *services.VMService, redis *database.RedisClient, jwtSecret string) *ConsoleHandler {
	return &ConsoleHandler{
		consoleService: consoleService,
		vmService:      vmService,
		redis:          redis,
		jwtSecret:      jwtSecret,
	}
}

func (h *ConsoleHandler) RequestConsoleSession(c *gin.Context) {
	idStr := c.Param("id")
	vmID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid VM UUID format"})
		return
	}

	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)
	role := middleware.GetUserRole(c)

	session, err := h.consoleService.RequestConsoleTicket(c.Request.Context(), vmID, userID, tenantID, role)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, session)
}

func (h *ConsoleHandler) HandleConsoleWebSocket(c *gin.Context) {
	idStr := c.Param("id")
	ticket := c.Query("ticket")
	tokenParam := c.Query("token")
	if tokenParam == "" {
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenParam = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	var targetVMID uuid.UUID
	var isAuthorized bool

	// 1. Authenticate via one-time session ticket stored in Redis
	if ticket != "" && h.redis != nil {
		cachedVMID, redisErr := h.redis.ValidateTicket(c.Request.Context(), ticket)
		if redisErr == nil && cachedVMID != "" {
			if parsedUUID, parseErr := uuid.Parse(cachedVMID); parseErr == nil {
				// Verify URL parameter matches the VM authorized by the ticket
				if reqUUID, reqErr := uuid.Parse(idStr); reqErr != nil || reqUUID == parsedUUID {
					targetVMID = parsedUUID
					isAuthorized = true
				} else {
					log.Printf("[Security] Console ticket VM mismatch: ticket for %s used on %s", parsedUUID, reqUUID)
				}
			}
		}
	}

	// 2. Alternatively authenticate via JWT token query param or Bearer header
	if !isAuthorized && tokenParam != "" && h.jwtSecret != "" {
		claims, err := middleware.ValidateTokenString(tokenParam, h.jwtSecret)
		if err == nil && claims != nil {
			if parsedUUID, parseErr := uuid.Parse(idStr); parseErr == nil {
				targetVMID = parsedUUID
				// If role is OPERATOR, verify explicit assignment
				if claims.Role == models.RoleOperator {
					hasAccess, accessErr := h.vmService.CheckOperatorVMAccess(c.Request.Context(), claims.UserID, targetVMID)
					if accessErr == nil && hasAccess {
						isAuthorized = true
					}
				} else {
					isAuthorized = true
				}
			}
		}
	}

	// Reject unauthenticated or unauthorized WebSocket connections
	if !isAuthorized {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: valid console session ticket or token is required"})
		return
	}

	vm, err := h.vmService.GetVMByID(c.Request.Context(), targetVMID)
	if err != nil || vm == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Virtual machine not found for console session"})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade WebSocket: %v", err)
		return
	}
	defer ws.Close()

	// Send initial terminal banner
	welcomeBanner := fmt.Sprintf("\r\n\x1b[1;36m========================================================================\x1b[0m\r\n"+
		"\x1b[1;32m  [Cloud Remote Console] Connected to %s (%s)\x1b[0m\r\n"+
		"  Hypervisor: %s | Node: %s | IP: %s\r\n"+
		"  Allocated: %d vCPU | %d MB RAM | %d GB Disk\r\n"+
		"\x1b[1;36m========================================================================\x1b[0m\r\n"+
		"Welcome to %s (GNU/Linux 6.5.0-generic x86_64)\r\n\r\n"+
		"Type \x1b[1;33mhelp\x1b[0m, \x1b[1;33mtop\x1b[0m, \x1b[1;33muname -a\x1b[0m, \x1b[1;33mfree -h\x1b[0m, \x1b[1;33mip a\x1b[0m, \x1b[1;33mdf -h\x1b[0m, or \x1b[1;33mclear\x1b[0m.\r\n\r\n"+
		"\x1b[1;32mroot@%s\x1b[0m:\x1b[1;34m~#\x1b[0m ",
		vm.Name, vm.HypervisorType, vm.HypervisorType, vm.NodeID, vm.IPAddress, vm.CPUCores, vm.RAMMB, vm.DiskGB, vm.OSType, vm.Name)

	_ = ws.WriteMessage(websocket.TextMessage, []byte(welcomeBanner))

	var currentLine string

	for {
		messageType, p, err := ws.ReadMessage()
		if err != nil {
			break
		}

		input := string(p)

		// Handle terminal control characters
		for _, ch := range input {
			if ch == '\r' || ch == '\n' {
				// Execute simulated command
				cmd := strings.TrimSpace(currentLine)
				ws.WriteMessage(websocket.TextMessage, []byte("\r\n"))
				currentLine = ""

				if cmd != "" {
					handleCommand(ws, cmd, vm)
				}
				prompt := fmt.Sprintf("\x1b[1;32mroot@%s\x1b[0m:\x1b[1;34m~#\x1b[0m ", vm.Name)
				ws.WriteMessage(websocket.TextMessage, []byte(prompt))

			} else if ch == 127 || ch == 8 { // Backspace
				if len(currentLine) > 0 {
					currentLine = currentLine[:len(currentLine)-1]
					ws.WriteMessage(websocket.TextMessage, []byte("\b \b"))
				}
			} else if ch == 12 { // Ctrl+L (Clear screen)
				ws.WriteMessage(websocket.TextMessage, []byte("\x1b[2J\x1b[H"))
				prompt := fmt.Sprintf("\x1b[1;32mroot@%s\x1b[0m:\x1b[1;34m~#\x1b[0m %s", vm.Name, currentLine)
				ws.WriteMessage(websocket.TextMessage, []byte(prompt))
			} else if ch == 3 { // Ctrl+C
				currentLine = ""
				ws.WriteMessage(websocket.TextMessage, []byte("^C\r\n"))
				prompt := fmt.Sprintf("\x1b[1;32mroot@%s\x1b[0m:\x1b[1;34m~#\x1b[0m ", vm.Name)
				ws.WriteMessage(websocket.TextMessage, []byte(prompt))
			} else if ch >= 32 && ch <= 126 { // Printable ASCII
				currentLine += string(ch)
				ws.WriteMessage(messageType, []byte(string(ch))) // Echo back
			}
		}
	}
}

func handleCommand(ws *websocket.Conn, cmd string, vm *models.VirtualMachine) {
	parts := strings.Fields(cmd)
	if len(parts) == 0 {
		return
	}

	switch parts[0] {
	case "help":
		ws.WriteMessage(websocket.TextMessage, []byte(
			"Available Cloud Console Commands:\r\n"+
				"  uname -a    Display kernel and architecture\r\n"+
				"  uptime      Show system uptime and load average\r\n"+
				"  free -h     Display RAM utilization\r\n"+
				"  df -h       Show filesystem disk capacity\r\n"+
				"  ip          Display network address and interfaces\r\n"+
				"  top         Show running processes\r\n"+
				"  hostname    Show VM hostname\r\n"+
				"  clear       Reset terminal screen\r\n"))

	case "uname":
		ws.WriteMessage(websocket.TextMessage, []byte(
			fmt.Sprintf("Linux %s 6.5.0-28-generic #29~22.04.1-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\r\n", vm.Name)))

	case "uptime":
		ws.WriteMessage(websocket.TextMessage, []byte(
			fmt.Sprintf(" 10:48:12 up 24 days,  3:18,  1 user,  load average: 0.12, 0.08, 0.04\r\n")))

	case "free":
		ramMB := vm.RAMMB
		usedMB := ramMB / 4
		ws.WriteMessage(websocket.TextMessage, []byte(
			fmt.Sprintf("               total        used        free      shared  buff/cache   available\r\n"+
				"Mem:          %5dM       %5dM       %5dM         12M        480M       %5dM\r\n"+
				"Swap:          2048M          0M       2048M\r\n", ramMB, usedMB, ramMB-usedMB-480, ramMB-usedMB)))

	case "df":
		ws.WriteMessage(websocket.TextMessage, []byte(
			fmt.Sprintf("Filesystem     Type      Size  Used Avail Use%% Mounted on\r\n"+
				"/dev/sda1      ext4       %dG   12G   %dG  24%% /\r\n"+
				"tmpfs          tmpfs     7.8G     0  7.8G   0%% /dev/shm\r\n"+
				"/dev/sda15     vfat      105M  6.1M   99M   6%% /boot/efi\r\n", vm.DiskGB, vm.DiskGB-12)))

	case "ip":
		ws.WriteMessage(websocket.TextMessage, []byte(
			fmt.Sprintf("1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\r\n"+
				"    inet 127.0.0.1/8 scope host lo\r\n"+
				"2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP qlen 1000\r\n"+
				"    link/ether %s\r\n"+
				"    inet %s/24 brd 10.10.1.255 scope global eth0\r\n", vm.MACAddress, vm.IPAddress)))

	case "top":
		ws.WriteMessage(websocket.TextMessage, []byte(
			fmt.Sprintf("top - 10:49:05 up 24 days, 1 user, load average: 0.08, 0.05, 0.02\r\n"+
				"Tasks: 142 total,   1 running, 141 sleeping,   0 stopped,   0 zombie\r\n"+
				"%%Cpu(s):  2.3 us,  0.8 sy,  0.0 ni, 96.8 id,  0.1 wa,  0.0 hi,  0.0 si\r\n"+
				"MiB Mem :  %5d total,  %5d free,  %5d used,   480 buff/cache\r\n\r\n"+
				"  PID USER      PR  NI    VIRT    RES    SHR S  %%CPU  %%MEM     TIME+ COMMAND\r\n"+
				"  842 root      20   0  124892  24120  12540 S   1.2   0.3   4:12.80 dockerd\r\n"+
				" 1120 root      20   0  712400  48200  28100 S   0.8   0.6   8:45.10 containerd\r\n"+
				" 1490 systemd   20   0   18240   3120   2800 S   0.1   0.0   0:15.20 systemd-journal\r\n"+
				" 1822 root      20   0   14200   3200   2850 R   0.0   0.0   0:00.08 top\r\n",
				vm.RAMMB, vm.RAMMB/2, vm.RAMMB/4)))

	case "hostname":
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("%s\r\n", vm.Name)))

	case "clear":
		ws.WriteMessage(websocket.TextMessage, []byte("\x1b[2J\x1b[H"))

	default:
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("bash: %s: command not found\r\n", parts[0])))
	}
}
