# Deployment on Hostinger

This application is designed to run as a single Node.js application, where the Express server serves the React production build. This makes it perfect for Hostinger's Node.js shared hosting or VPS.

## Prerequisites
- A Hostinger plan that supports Node.js.
- A MySQL Database created in the Hostinger control panel.

## Steps

### 1. Build the Frontend
Before uploading your code, generate the production build of the React app locally (or on a CI pipeline).
```bash
cd client
npm install
npm run build
```
This generates the `client/dist` directory.

### 2. Configure the Database
In your Hostinger hPanel, create a new MySQL database and user.
Create a `.env` file in your `server` directory and configure the `DATABASE_URL`:
```
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/DATABASE_NAME"
PORT=5000
JWT_SECRET="generate-a-strong-secret"
NODE_ENV="production"
```

### 3. Deploy Files
Upload the following files to your Hostinger server (typically using File Manager or SSH/Git):
- The entire `server/` directory (excluding `node_modules`).
- The `client/dist` directory (ensure it stays at the path `../client/dist` relative to `server/src/app.js`, or update the path in `app.js`).

### 4. Install Dependencies & Migrate
SSH into your Hostinger server and navigate to the `server` directory.
```bash
npm install --production
npx prisma generate
npx prisma migrate deploy
```

### 5. Start the Application
Hostinger typically uses Phusion Passenger or PM2 for Node.js apps.
- If using **Phusion Passenger**: Ensure the application startup file is set to `server.js` or `app.js` as required by the panel.
- If using **PM2** (VPS): Run `pm2 start server.js --name "invitation-app"`.

The server will automatically serve the static React frontend from `client/dist`, meaning your React app and API run seamlessly on the same domain and port without CORS issues.
