#!/bin/bash
#
# KronosCode Service Auto-Start Script
# Starts all required external services (Jaaz, Nocobase, etc.)
# Usage: ./scripts/auto-start-services.sh [start|stop|status]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Log directory
LOG_DIR="$PROJECT_ROOT/.service-logs"
mkdir -p "$LOG_DIR"

# PID file
PID_FILE="$PROJECT_ROOT/.service-pids"

# Service ports
JAAZ_SERVER_PORT=8001
JAAZ_WEB_PORT=5173
NOCOBASE_PORT=13000

# Check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Kill process by port
kill_port() {
    local port=$1
    local pid
    pid=$(lsof -Pi ":$port" -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$pid" ]; then
        kill -9 "$pid" 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Killed process on port $port"
    fi
}

# Start Jaaz services
start_jaaz() {
    echo -e "${BLUE}▶${NC} Starting Jaaz services..."
    
    # Check if already running
    if check_port $JAAZ_SERVER_PORT; then
        echo -e "${YELLOW}⚠${NC} Jaaz server already running on port $JAAZ_SERVER_PORT"
    else
        # Start Python backend
        cd "$PROJECT_ROOT/third_party/upstream/jaaz/server"
        if [ -f "main.py" ]; then
            nohup python main.py > "$LOG_DIR/jaaz-server.log" 2>&1 &
            echo $! >> "$PID_FILE"
            echo -e "${GREEN}✓${NC} Jaaz Python server starting on port $JAAZ_SERVER_PORT..."
            sleep 2
        else
            echo -e "${RED}✗${NC} Jaaz server main.py not found"
        fi
    fi
    
    if check_port $JAAZ_WEB_PORT; then
        echo -e "${YELLOW}⚠${NC} Jaaz web UI already running on port $JAAZ_WEB_PORT"
    else
        # Start React frontend
        cd "$PROJECT_ROOT/third_party/upstream/jaaz/react"
        if [ -d "node_modules" ]; then
            nohup npm run dev > "$LOG_DIR/jaaz-web.log" 2>&1 &
            echo $! >> "$PID_FILE"
            echo -e "${GREEN}✓${NC} Jaaz React dev server starting on port $JAAZ_WEB_PORT..."
            sleep 3
        else
            echo -e "${RED}✗${NC} Jaaz React dependencies not installed. Run: cd react && npm install --force${NC}"
        fi
    fi
}

# Start Nocobase
start_nocobase() {
    echo -e "${BLUE}▶${NC} Starting Nocobase..."
    
    if check_port $NOCOBASE_PORT; then
        echo -e "${YELLOW}⚠${NC} Nocobase already running on port $NOCOBASE_PORT"
        return
    fi
    
    cd "$PROJECT_ROOT/third_party/upstream/nocobase"
    
    # Check if built
    if [ ! -d "node_modules" ]; then
        echo -e "${RED}✗${NC} Nocobase not installed. Run: cd nocobase && yarn install${NC}"
        return
    fi
    
    # Check environment
    if [ ! -f ".env" ] && [ ! -f ".env.production" ]; then
        echo -e "${YELLOW}⚠${NC} Nocobase .env not configured. Copy .env.example and set database credentials.${NC}"
        return
    fi
    
    nohup yarn start > "$LOG_DIR/nocobase.log" 2>&1 &
    echo $! >> "$PID_FILE"
    echo -e "${GREEN}✓${NC} Nocobase starting on port $NOCOBASE_PORT..."
    sleep 5
}

# Stop all services
stop_all() {
    echo -e "${BLUE}▶${NC} Stopping all services..."
    
    # Kill by port
    kill_port $JAAZ_SERVER_PORT
    kill_port $JAAZ_WEB_PORT
    kill_port $NOCOBASE_PORT
    
    # Kill by PID file
    if [ -f "$PID_FILE" ]; then
        while read pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
    
    echo -e "${GREEN}✓${NC} All services stopped"
}

# Check status
check_status() {
    echo -e "${BLUE}▶${NC} Service Status:"
    echo ""
    
    echo -n "Jaaz Server (port $JAAZ_SERVER_PORT): "
    if check_port $JAAZ_SERVER_PORT; then
        echo -e "${GREEN}RUNNING${NC}"
    else
        echo -e "${RED}STOPPED${NC}"
    fi
    
    echo -n "Jaaz Web UI (port $JAAZ_WEB_PORT): "
    if check_port $JAAZ_WEB_PORT; then
        echo -e "${GREEN}RUNNING${NC}"
    else
        echo -e "${RED}STOPPED${NC}"
    fi
    
    echo -n "Nocobase (port $NOCOBASE_PORT): "
    if check_port $NOCOBASE_PORT; then
        echo -e "${GREEN}RUNNING${NC}"
    else
        echo -e "${RED}STOPPED${NC}"
    fi
}

# Setup environment
setup_env() {
    echo -e "${BLUE}▶${NC} Setting up environment variables..."
    
    # Check if .env exists in kronosChamber
    CHAMBER_ENV="$PROJECT_ROOT/kronosChamber/.env"
    if [ ! -f "$CHAMBER_ENV" ]; then
        echo "Creating kronosChamber/.env..."
        cat > "$CHAMBER_ENV" << 'EOF'
# KronosChamber Configuration
OPENCHAMBER_JAAZ_APP_ORIGIN=http://localhost:5173
OPENCHAMBER_JAAZ_API_URL=http://localhost:8001
EOF
        echo -e "${GREEN}✓${NC} Created $CHAMBER_ENV"
    else
        # Check if Jaaz vars are already set
        if ! grep -q "OPENCHAMBER_JAAZ_APP_ORIGIN" "$CHAMBER_ENV"; then
            echo "" >> "$CHAMBER_ENV"
            echo "# Jaaz Configuration" >> "$CHAMBER_ENV"
            echo "OPENCHAMBER_JAAZ_APP_ORIGIN=http://localhost:5173" >> "$CHAMBER_ENV"
            echo "OPENCHAMBER_JAAZ_API_URL=http://localhost:8001" >> "$CHAMBER_ENV"
            echo -e "${GREEN}✓${NC} Added Jaaz environment variables to $CHAMBER_ENV"
        else
            echo -e "${YELLOW}⚠${NC} Jaaz environment variables already configured"
        fi
    fi
}

# Install dependencies
install_deps() {
    echo -e "${BLUE}▶${NC} Installing service dependencies..."
    
    # Install Jaaz React dependencies
    if [ -d "$PROJECT_ROOT/third_party/upstream/jaaz/react" ]; then
        cd "$PROJECT_ROOT/third_party/upstream/jaaz/react"
        if [ ! -d "node_modules" ]; then
            echo "Installing Jaaz React dependencies..."
            npm install --force
            echo -e "${GREEN}✓${NC} Jaaz React dependencies installed"
        else
            echo -e "${YELLOW}⚠${NC} Jaaz React dependencies already installed"
        fi
    fi
    
    # Install Jaaz Python dependencies
    if [ -d "$PROJECT_ROOT/third_party/upstream/jaaz/server" ]; then
        cd "$PROJECT_ROOT/third_party/upstream/jaaz/server"
        if [ -f "requirements.txt" ]; then
            echo "Installing Jaaz Python dependencies..."
            pip install -r requirements.txt
            echo -e "${GREEN}✓${NC} Jaaz Python dependencies installed"
        fi
    fi
}

# Main command handler
case "${1:-start}" in
    start)
        echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║   KronosCode Service Auto-Start        ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
        echo ""
        setup_env
        install_deps
        start_jaaz
        # start_nocobase  # Uncomment when Nocobase is configured
        echo ""
        check_status
        echo ""
        echo -e "${GREEN}✓${NC} Services started! View logs in: $LOG_DIR"
        echo -e "${YELLOW}⚠${NC} Remember to restart kronosChamber web server to pick up env changes:"
        echo "   cd kronosChamber && bun run dev"
        ;;
    
    stop)
        stop_all
        ;;
    
    status)
        check_status
        ;;
    
    restart)
        stop_all
        sleep 2
        $0 start
        ;;
    
    setup)
        setup_env
        install_deps
        ;;
    
    *)
        echo "Usage: $0 [start|stop|status|restart|setup]"
        echo ""
        echo "Commands:"
        echo "  start   - Start all services and configure environment"
        echo "  stop    - Stop all services"
        echo "  status  - Check service status"
        echo "  restart - Restart all services"
        echo "  setup   - Install dependencies and configure environment only"
        exit 1
        ;;
esac
