const fs = require("fs");
const serverCode = `require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const app = require("./src/app");

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

server.listen(PORT, () => {
  console.log(\`Server is running on port \${PORT}\`);
});
`;
fs.writeFileSync("server/server.js", serverCode);
console.log("Server.js updated for socket.io");

