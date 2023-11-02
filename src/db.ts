import mysql from "mysql";
import path from "path";
import dotenv from "dotenv";
const ENV_PATH = path.join(__dirname, '/../.env');

dotenv.config({ path: ENV_PATH });

// データベース接続情報
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "my-secret-pw",
  database: process.env.DB_NAME || "line_notify",
};

// MySQLデータベースへの接続を確立する関数
export function connectToDatabase() {
  const connection = mysql.createConnection(dbConfig);
  connection.connect((err) => {
    if (err) {
      console.error("Error connecting to database: " + err.stack);
      return;
    }
    console.log("Connected to database as id " + connection.threadId);
  });
  return connection;
}