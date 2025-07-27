# 🚀 Deployment Guide for VPS

This guide will help you deploy your Retro Recap Room application on your VPS.

## 📋 Prerequisites

- VPS with Node.js installed
- Domain name (optional but recommended)
- Nginx (for reverse proxy)

## 🔧 Backend Deployment

### 1. Upload Backend Files
```bash
# On your VPS, create the project directory
mkdir -p /var/www/retro-recap-room
cd /var/www/retro-recap-room

# Upload the backend folder to your VPS
# You can use scp, rsync, or git clone
```

### 2. Install Dependencies
```bash
cd backend
npm install --production
```

### 3. Set Up Environment
```bash
# Create uploads directory
mkdir -p uploads

# Set proper permissions
chmod 755 uploads
chmod 644 photos-data.json
```

### 4. Configure PM2 (Process Manager)
```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'retro-recap-backend',
    script: 'server.js',
    cwd: '/var/www/retro-recap-room/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
EOF

# Start the application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🌐 Frontend Deployment

### 1. Build the Frontend
```bash
# On your local machine or VPS
cd /var/www/retro-recap-room
npm install
npm run build
```

### 2. Update API URL
Before building, update the API URL in `src/components/Gallery.tsx`:
```typescript
// Change this line:
const API_BASE_URL = 'http://localhost:3001/api';

// To your VPS domain/IP:
const API_BASE_URL = 'https://your-domain.com/api';
// or
const API_BASE_URL = 'http://your-vps-ip:3001/api';
```

### 3. Serve with Nginx
```bash
# Install Nginx
sudo apt update
sudo apt install nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/retro-recap-room
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com; # Replace with your domain

    # Frontend
    location / {
        root /var/www/retro-recap-room/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve uploaded images
    location /uploads/ {
        alias /var/www/retro-recap-room/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/retro-recap-room /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📸 Adding Event Photos

### Option 1: Using the Helper Script
```bash
cd /var/www/retro-recap-room/backend

# Add a single photo
node add-photo.js /path/to/your/photo.jpg "Event Title" "Event description"

# Add multiple photos
for photo in /path/to/photos/*.jpg; do
    node add-photo.js "$photo" "Event Photo" "From our amazing event"
done
```

### Option 2: Using the Web Interface
1. Open your deployed application
2. Go to The Gallery
3. Click "Upload"
4. Select photos and add details

### Option 3: Direct File Upload
```bash
# Copy photos to uploads directory
cp /path/to/your/photos/* /var/www/retro-recap-room/backend/uploads/

# Then manually edit photos-data.json to add metadata
nano /var/www/retro-recap-room/backend/photos-data.json
```

## 🔒 Security Considerations

### 1. HTTPS Setup
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 2. Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 3. File Permissions
```bash
# Set proper ownership
sudo chown -R www-data:www-data /var/www/retro-recap-room/backend/uploads
sudo chmod 755 /var/www/retro-recap-room/backend/uploads
```

## 🔄 Updates and Maintenance

### Update Backend
```bash
cd /var/www/retro-recap-room/backend
git pull  # if using git
npm install
pm2 restart retro-recap-backend
```

### Update Frontend
```bash
cd /var/www/retro-recap-room
git pull  # if using git
npm install
npm run build
sudo systemctl reload nginx
```

## 📊 Monitoring

### Check Application Status
```bash
pm2 status
pm2 logs retro-recap-backend
```

### Check Nginx Status
```bash
sudo systemctl status nginx
sudo nginx -t
```

## 🆘 Troubleshooting

### Common Issues

1. **Photos not loading**: Check file permissions in uploads directory
2. **API errors**: Check PM2 logs and backend status
3. **Frontend not updating**: Clear browser cache or check build process
4. **Upload failures**: Check disk space and file permissions

### Logs Location
- Backend logs: `pm2 logs retro-recap-backend`
- Nginx logs: `/var/log/nginx/error.log`
- System logs: `journalctl -u nginx` 