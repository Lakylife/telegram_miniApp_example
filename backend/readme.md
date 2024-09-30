# Telegram miniApp example Backend

This is the backend server for the PizzaPenny Telegram miniApp project. It is built using Node.js, Express, MySQL, and integrates with a Telegram bot. This guide will walk you through setting up the backend on Ubuntu 22.04, including configuration with NGINX and a React frontend.

## Prerequisites

Before starting, ensure you have the following installed on your Ubuntu 22.04 server:

1. **Node.js** (version 16 or higher)
2. **npm** (Node package manager)
3. **MySQL** (version 5.7 or higher)
4. **Nginx**
5. **Git**
6. **PM2** (for process management)
7. **React** (for the frontend integration)
8. **A Telegram Bot Token** from [BotFather](https://core.telegram.org/bots#botfather)
9. **.env file with environment variables**

## Installation Guide

### Step 1: Clone the repository

```cd backend```

## Step 2: Install Node.js and npm
If you haven't already installed Node.js and npm, do so with the following commands:

```
sudo apt update
sudo apt install nodejs npm
node -v
npm -v
```

## Step 3: Install MySQL
You need a MySQL server running on your machine. If it's not installed, install it with:
```
sudo apt install mysql-server
sudo systemctl start mysql
sudo mysql_secure_installation
```
After installation, log into MySQL and create a database for the project:
```
mysql -u root -p
CREATE DATABASE db_name;
EXIT;
```
## Step 4: Install Dependencies
Install the required Node.js packages by running:
```
npm install
```
## Step 5: Set up the Environment Variables
Create a .env file in the project root and add your environment variables as follows:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
WEBHOOK_URL=https://yourdomain.com
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=db_name
PORT=1111
```
Make sure the .env file is properly configured with your Telegram bot token and MySQL credentials.

## Step 6: Run Database Migrations
If there are database migrations or schema setup scripts, run them to initialize your database schema.
```
# In MySQL CLI
USE db_name;
SOURCE path_to_your_sql_file.sql;
```
## Step 7: Set up Nginx
Install and configure Nginx as a reverse proxy for the backend.
```
sudo apt install nginx
sudo nano /etc/nginx/sites-available/default
```
Add the following Nginx configuration:
```
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:1111;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /bot {
        proxy_pass http://localhost:4215;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
After configuring, restart Nginx:
```
sudo systemctl restart nginx
```


