#!/bin/bash

# Backend Server Management Script
# Usage: ./manage-server.sh [start|stop|restart|status|logs]

case "$1" in
    start)
        echo "🚀 Starting Barrana Backend Server..."
        cd /Users/faran/school-project/backend
        pm2 start ecosystem.config.js
        ;;
    stop)
        echo "🛑 Stopping Barrana Backend Server..."
        pm2 stop barrana-backend
        ;;
    restart)
        echo "🔄 Restarting Barrana Backend Server..."
        pm2 restart barrana-backend
        ;;
    status)
        echo "📊 Backend Server Status:"
        pm2 status
        ;;
    logs)
        echo "📋 Backend Server Logs:"
        pm2 logs barrana-backend --lines 50
        ;;
    monitor)
        echo "🖥️ Opening PM2 Monitor..."
        pm2 monit
        ;;
    save)
        echo "💾 Saving PM2 Configuration..."
        pm2 save
        ;;
    *)
        echo "🔧 Barrana Backend Server Manager"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|monitor|save}"
        echo ""
        echo "Commands:"
        echo "  start    - Start the backend server"
        echo "  stop     - Stop the backend server"
        echo "  restart  - Restart the backend server"
        echo "  status   - Show server status"
        echo "  logs     - Show recent logs"
        echo "  monitor  - Open PM2 monitoring dashboard"
        echo "  save     - Save current PM2 configuration"
        echo ""
        echo "Current Status:"
        pm2 status
        ;;
esac
