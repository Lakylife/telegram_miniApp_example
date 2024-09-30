# Telegram miniApp Frontend

This is the frontend for the Telegram miniApp project built with React and TypeScript, and using Vite as the development server. This guide will walk you through setting up and running the frontend on your local machine or server.

## Support the Project

If you'd like to support the development of this project, you can make a voluntary donation to the following ERC20 Ethereum address:

**ETH Address**: `0x88703E0Ed80E1C7D7B5F91679C7b1B23949448ef`

Your contributions are greatly appreciated and will help keep the project alive and growing!

## Prerequisites

Before you begin, make sure you have the following installed on your system:

1. **Node.js** (version 16 or higher)
2. **npm** (Node package manager)
3. **Git**

## Installation Guide

### Step 1: Clone the repository

Clone the frontend repository to your local machine:

```
git clone https://github.com/your-repo/pizzapenny-frontend.git
cd pizzapenny-frontend
```

### Step 2: Install Node.js and npm (if not already installed)
If you don't have Node.js and npm installed, you can install them using the following commands:
```
sudo apt update
sudo apt install nodejs npm
node -v
npm -v
```
Ensure that Node.js is version 16 or higher.

### Step 3: Install dependencies
Install all the project dependencies using npm:
```
npm install
```
This will install all the required dependencies listed in the package.json file.

### Step 4: Set up environment variables
Create a .env file in the root directory and add the following environment variables:
```
VITE_API_URL=https://api.example.com
VITE_PORT=4444
```
Make sure to replace https://api.example.com with the actual backend API URL.

### Step 5: Run the development server
You can run the development server using the following command:
```
npm run dev
```
This will start the development server, and the app will be available at http://localhost:4444. You can access it from your browser to see the frontend in action.

### Step 6: Build for production
To build the project for production, run the following command:
```
npm run build
```
Technologies used
React (18.x)
Vite (5.x)
TypeScript
i18next (for translations)
Axios (for API requests)
React Router (for routing)
React Icons (for icons)
UUID (for generating unique IDs)


