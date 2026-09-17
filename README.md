# Invitation Management Application

A full-stack, production-ready invitation management system built with React, Express, Prisma, and MySQL. It features role-based access control, secure RSVP tracking, and a dynamic PDF template editor.

## Features
- **Admin Dashboard**: Real-time stats and robust user management.
- **Invitation & Recipient Management**: Batch import/export from Excel, complete CRUD, sender-level isolation.
- **Custom PDF Engine**: Upload a base PDF template, drag and drop the recipient name visually, and generate custom PDFs on the fly using `pdf-lib`.
- **Public RSVP Pages**: Secure, unique URLs for each guest to accept, decline, or mark maybe.
- **Check-in Tracking**: Monitor live event attendance.

## Project Structure
This repository contains a monolithic structure for easy deployment on environments like Hostinger's Node.js platform.
- `client/`: React frontend (Vite, TailwindCSS, React Router).
- `server/`: Express backend (Prisma, MySQL, Nodemailer, Multer).

## Local Setup
1. Duplicate `.env.example` to `.env` in the `server` directory and fill in the database configuration.
2. In `server/`: Run `npm install`, then `npx prisma migrate dev`, and `node server.js`.
3. In `client/`: Run `npm install`, then `npm run dev`.

See `DEPLOYMENT.md` for production deployment instructions on Hostinger.
