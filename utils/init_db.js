const mysql = require('mysql');
const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');

const ENV_PATH = path.join(__dirname, '/../.env');

dotenv.config({ path: ENV_PATH });

// データベース接続情報
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'my-secret-pw',
  database: process.env.DB_NAME || 'line_notify',
  multipleStatements: true,
};

// SQLファイルを読み込む
const sqlScript = fs.readFileSync(__dirname + '/init_db.sql', 'utf8');

// MySQLデータベースに接続
const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ' + err.stack);
    return;
  }
  console.log('Connected to the database as id ' + connection.threadId);

  // SQLファイルを実行
  connection.query(sqlScript, (error, results) => {
    if (error) {
      console.error('Error executing SQL script: ' + error);
      return;
    }
    console.log('Database initialization script executed successfully');
  });

  // データベース接続を閉じる
  connection.end();
});
