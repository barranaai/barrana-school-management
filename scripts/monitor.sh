#!/bin/bash

# Barrana.ai School Management System - Production Monitoring Script
# This script monitors the system health and performance

set -e

# Configuration
API_BASE="http://localhost:5001"
HEALTH_ENDPOINT="$API_BASE/api/health"
LOG_FILE="./logs/monitor.log"
ALERT_EMAIL="admin@barrana.ai"
CHECK_INTERVAL=60  # seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR]${NC} $1"
}

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to send alert
send_alert() {
    local subject="$1"
    local message="$2"
    
    if command_exists mail; then
        echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
    fi
    
    log_message "ALERT: $subject - $message"
}

# Function to check system health
check_health() {
    local response
    local status_code
    
    # Check API health endpoint
    if command_exists curl; then
        response=$(curl -s -w "%{http_code}" "$HEALTH_ENDPOINT" || echo "000")
        status_code="${response: -3}"
        response_body="${response%???}"
        
        if [ "$status_code" = "200" ]; then
            print_success "API Health Check: OK"
            log_message "Health check passed"
            
            # Parse response for additional metrics
            if command_exists jq; then
                local uptime=$(echo "$response_body" | jq -r '.uptime // "unknown"')
                local request_count=$(echo "$response_body" | jq -r '.requestCount // "unknown"')
                local error_count=$(echo "$response_body" | jq -r '.errorCount // "unknown"')
                local active_connections=$(echo "$response_body" | jq -r '.activeConnections // "unknown"')
                
                print_status "Uptime: ${uptime}s | Requests: $request_count | Errors: $error_count | Active Connections: $active_connections"
            fi
        else
            print_error "API Health Check: FAILED (Status: $status_code)"
            log_message "Health check failed with status $status_code"
            send_alert "Barrana.ai Health Check Failed" "API health check returned status $status_code"
        fi
    else
        print_warning "curl not available, skipping health check"
    fi
}

# Function to check system resources
check_resources() {
    # Check CPU usage
    if command_exists top; then
        local cpu_usage=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
        if [ -n "$cpu_usage" ] && [ "$cpu_usage" -gt 80 ]; then
            print_warning "High CPU usage: ${cpu_usage}%"
            log_message "High CPU usage detected: ${cpu_usage}%"
        else
            print_status "CPU usage: ${cpu_usage}%"
        fi
    fi
    
    # Check memory usage
    if command_exists vm_stat; then
        local memory_info=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        local total_memory=$(sysctl hw.memsize | awk '{print $2}')
        local free_memory=$((memory_info * 4096))
        local memory_usage=$((100 - (free_memory * 100 / total_memory)))
        
        if [ "$memory_usage" -gt 85 ]; then
            print_warning "High memory usage: ${memory_usage}%"
            log_message "High memory usage detected: ${memory_usage}%"
        else
            print_status "Memory usage: ${memory_usage}%"
        fi
    fi
    
    # Check disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 85 ]; then
        print_warning "High disk usage: ${disk_usage}%"
        log_message "High disk usage detected: ${disk_usage}%"
    else
        print_status "Disk usage: ${disk_usage}%"
    fi
}

# Function to check process status
check_process() {
    if pgrep -f "server-production.js" > /dev/null; then
        print_success "Barrana.ai process: RUNNING"
        log_message "Process check passed"
    else
        print_error "Barrana.ai process: NOT RUNNING"
        log_message "Process check failed - server not running"
        send_alert "Barrana.ai Process Down" "The Barrana.ai server process is not running"
    fi
}

# Function to check port availability
check_port() {
    if command_exists lsof; then
        if lsof -i :5001 > /dev/null 2>&1; then
            print_success "Port 5001: LISTENING"
        else
            print_error "Port 5001: NOT LISTENING"
            log_message "Port check failed - port 5001 not listening"
            send_alert "Barrana.ai Port Not Listening" "Port 5001 is not listening"
        fi
    else
        print_warning "lsof not available, skipping port check"
    fi
}

# Function to check log files
check_logs() {
    local log_dir="./logs"
    if [ -d "$log_dir" ]; then
        local error_log="$log_dir/error.log"
        if [ -f "$error_log" ]; then
            local recent_errors=$(tail -n 10 "$error_log" | grep -c "ERROR" || echo "0")
            if [ "$recent_errors" -gt 5 ]; then
                print_warning "High error rate in logs: $recent_errors recent errors"
                log_message "High error rate detected: $recent_errors recent errors"
            fi
        fi
    fi
}

# Function to generate system report
generate_report() {
    local report_file="./logs/system-report-$(date '+%Y%m%d-%H%M%S').txt"
    
    echo "Barrana.ai School Management System - System Report" > "$report_file"
    echo "Generated: $(date)" >> "$report_file"
    echo "==================================================" >> "$report_file"
    echo "" >> "$report_file"
    
    # System information
    echo "System Information:" >> "$report_file"
    echo "  OS: $(uname -s) $(uname -r)" >> "$report_file"
    echo "  Hostname: $(hostname)" >> "$report_file"
    echo "  Uptime: $(uptime)" >> "$report_file"
    echo "" >> "$report_file"
    
    # Process information
    echo "Process Information:" >> "$report_file"
    if pgrep -f "server-production.js" > /dev/null; then
        echo "  Barrana.ai Server: RUNNING" >> "$report_file"
        ps aux | grep "server-production.js" | grep -v grep >> "$report_file"
    else
        echo "  Barrana.ai Server: NOT RUNNING" >> "$report_file"
    fi
    echo "" >> "$report_file"
    
    # Resource usage
    echo "Resource Usage:" >> "$report_file"
    if command_exists top; then
        top -l 1 | head -10 >> "$report_file"
    fi
    echo "" >> "$report_file"
    
    # Network information
    echo "Network Information:" >> "$report_file"
    if command_exists lsof; then
        lsof -i :5001 >> "$report_file" 2>/dev/null || echo "  Port 5001 not listening" >> "$report_file"
    fi
    echo "" >> "$report_file"
    
    # Recent logs
    echo "Recent Logs:" >> "$report_file"
    if [ -f "$LOG_FILE" ]; then
        tail -n 20 "$LOG_FILE" >> "$report_file"
    fi
    
    print_success "System report generated: $report_file"
}

# Function to cleanup old logs
cleanup_logs() {
    local log_dir="./logs"
    if [ -d "$log_dir" ]; then
        # Remove log files older than 30 days
        find "$log_dir" -name "*.log" -mtime +30 -delete 2>/dev/null || true
        find "$log_dir" -name "system-report-*.txt" -mtime +7 -delete 2>/dev/null || true
        print_status "Log cleanup completed"
    fi
}

# Function to show help
show_help() {
    echo "Barrana.ai School Management System - Monitoring Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -c, --check         Run a single health check"
    echo "  -m, --monitor       Run continuous monitoring"
    echo "  -r, --report        Generate system report"
    echo "  -i, --interval SEC  Set check interval in seconds (default: 60)"
    echo "  -e, --email EMAIL   Set alert email address"
    echo ""
    echo "Examples:"
    echo "  $0 -c              # Run single health check"
    echo "  $0 -m              # Start continuous monitoring"
    echo "  $0 -r              # Generate system report"
    echo "  $0 -m -i 30        # Monitor with 30-second intervals"
}

# Main monitoring loop
monitor_loop() {
    print_status "Starting Barrana.ai monitoring..."
    print_status "Check interval: ${CHECK_INTERVAL} seconds"
    print_status "Alert email: $ALERT_EMAIL"
    print_status "Log file: $LOG_FILE"
    echo ""
    
    # Create logs directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Initial cleanup
    cleanup_logs
    
    while true; do
        print_status "Running health checks..."
        
        check_process
        check_port
        check_health
        check_resources
        check_logs
        
        print_status "Health checks completed"
        echo ""
        
        # Wait for next check
        sleep "$CHECK_INTERVAL"
    done
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -c|--check)
        print_status "Running single health check..."
        check_process
        check_port
        check_health
        check_resources
        check_logs
        print_success "Health check completed"
        exit 0
        ;;
    -m|--monitor)
        monitor_loop
        ;;
    -r|--report)
        generate_report
        exit 0
        ;;
    -i|--interval)
        if [ -n "$2" ]; then
            CHECK_INTERVAL="$2"
            shift 2
        else
            print_error "Interval value required"
            exit 1
        fi
        ;;
    -e|--email)
        if [ -n "$2" ]; then
            ALERT_EMAIL="$2"
            shift 2
        else
            print_error "Email address required"
            exit 1
        fi
        ;;
    "")
        show_help
        exit 1
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac

# If we get here, we're in monitor mode
monitor_loop 