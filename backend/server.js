// Expense Tracker - backend (Express API + PostgreSQL)
//
// PHASE 1
// Setup:
//   1. Create a database named expense_tracker and run schema.sql on it.
//   2. Copy .env.example to a new file named .env and write your PostgreSQL password.
//   3. npm install express cors pg dotenv
// Run:    node server.js   (restart it every time you change this file)
//
// Endpoints you need to build:
//   GET    /api/expenses        return all expenses
//   GET    /api/expenses/:id    return one expense (404 if not found)
//   POST   /api/expenses        add an expense (201, or 400 if the data is invalid)
//   PUT    /api/expenses/:id    update an expense (200, 400, or 404)
//   DELETE /api/expenses/:id    delete an expense (200, or 404)
//
// Tips:
//   - Create one Pool (from the "pg" library) with the values from .env,
//     and use pool.query(...) in every route.
//   - ALWAYS send the values as parameters: pool.query("... WHERE id = $1", [id]).
//     NEVER build the SQL text by joining strings with data from the user.
//   - Use RETURNING to get the new (or updated) row back from INSERT and UPDATE.
//   - The database creates the id. The client never sends one.
//   - pg returns NUMERIC as text and DATE as a JavaScript Date, so fix both in your SELECT.
//     Hint: amount::float8 and to_char(date, 'YYYY-MM-DD').
//   - Validate the data before the query, and answer 400 with a message that explains the problem.
//   - Check the id before the query. A text like "abc" makes PostgreSQL throw an error.
//   - Enable CORS so the frontend can talk to the server.
//   - Test every endpoint with Thunder Client BEFORE you connect the frontend.
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const {
    Pool
} = require("pg");

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // optional safety settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// 4. Middleware (things that run on EVERY request)
app.use(cors());
app.use(express.json());

// 5. Routes (the actual API endpoints)
//    GET    /api/expenses
app.get("/api/expenses", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        id, 
        title, 
        amount::float8 AS amount, 
        category, 
        to_char(date, 'YYYY-MM-DD') AS date
      FROM expenses
      ORDER BY date DESC, id DESC
    `);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: "server error",
        });
    }
});
//    GET    /api/expenses/:id
app.get("/api/expenses/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "id must be a positive integer",
        });
    }
    try {
        const result = await pool.query(
            `
        SELECT 
        id, 
        title, 
        amount::float8 AS amount, 
        category, 
        to_char(date, 'YYYY-MM-DD') AS date
        FROM expenses
        WHERE id = $1`,
            [id],
        );
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "expense not found",
            });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: "server error",
        });
    }
});
//    POST   /api/expenses
app.post("/api/expenses", async (req, res) => {
    const {
        title,
        amount,
        category,
        date
    } = req.body;

    // ----- Validation -----
    if (!title || title.trim() === "") {
        return res.status(400).json({
            error: "title is required",
        });
    }

    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
            error: "amount must be a number greater than 0",
        });
    }

    if (!category || category.trim() === "") {
        return res.status(400).json({
            error: "category is required",
        });
    }

    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!date || !dateRegex.test(date)) {
        return res.status(400).json({
            error: "date must be in format YYYY-MM-DD",
        });
    }

    // ----- Database -----
    try {
        const result = await pool.query(
            `
      INSERT INTO expenses (title, amount, category, date)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id, 
        title, 
        amount::float8 AS amount, 
        category, 
        to_char(date, 'YYYY-MM-DD') AS date
      `,
            [title.trim(), numAmount, category.trim(), date],
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: "server error",
        });
    }
});
//    PUT    /api/expenses/:id
app.put("/api/expenses/:id", async (req, res) => {
    // 1. Get and validate the id from the URL
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "id must be a positive integer"
        });
    }

    // 2. Get the data from the body
    const {
        title,
        amount,
        category,
        date
    } = req.body;

    // 3. Validate the body (same rules as POST)
    if (!title || title.trim() === "") {
        return res.status(400).json({
            error: "title is required"
        });
    }

    const numAmount = Number(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
        return res
            .status(400)
            .json({
                error: "amount must be a number greater than 0"
            });
    }

    if (!category || category.trim() === "") {
        return res.status(400).json({
            error: "category is required"
        });
    }

    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!date || !dateRegex.test(date)) {
        return res.status(400).json({
            error: "date must be in format YYYY-MM-DD"
        });
    }

    // 4. Database
    try {
        const result = await pool.query(
            `
      UPDATE expenses
      SET title = $1,
          amount = $2,
          category = $3,
          date = $4
      WHERE id = $5
      RETURNING 
        id, 
        title, 
        amount::float8 AS amount, 
        category, 
        to_char(date, 'YYYY-MM-DD') AS date
      `,
            [title.trim(), numAmount, category.trim(), date, id],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "expense not found"
            });
        }

        res.status(200).json(result.rows[0]); // 200 for update
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: "server error"
        });
    }
});
//    DELETE /api/expenses/:id
app.delete("/api/expenses/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "id must be a positive integer" });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM expenses
      WHERE id = $1
      RETURNING 
        id, 
        title, 
        amount::float8 AS amount, 
        category, 
        to_char(date, 'YYYY-MM-DD') AS date
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "expense not found" });
    }

    res.status(200).json({ message: "expense deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});
// 6. Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
