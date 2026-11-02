
import os
import sqlite3
import logging
from contextlib import contextmanager
from datetime import datetime, timedelta
from statistics import mean

@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/style.css")
def stylesheet():
    return send_from_directory(BASE_DIR, "style.css")


@app.route("/script.js")
def javascript():
    return send_from_directory(BASE_DIR, "script.js")
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "stockwise.db")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("STOCKWISE")


# ============== DATABASE ==============

@contextmanager
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")

    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize_database():
    with get_db() as db:

        db.execute("""
            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                sale_date TEXT NOT NULL
            )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS deliveries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                supplier_name TEXT NOT NULL,
                expected_date TEXT NOT NULL,
                actual_date TEXT NOT NULL,
                lead_time INTEGER NOT NULL
            )
        """)

        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_sales_date
            ON sales(sale_date)
        """)

        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_deliveries_supplier
            ON deliveries(supplier_name)
        """)


# ============== VALIDATION ==============

def read_json():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        raise ValueError("Please provide valid JSON data.")

    return data


def required_text(data, field):
    value = data.get(field)

    if not isinstance(value, str) or not value.strip():
        raise ValueError(field + " is required.")

    return value.strip()


def number(data, field, minimum=0, maximum=100000000):
    value = data.get(field)

    if isinstance(value, bool):
        raise ValueError(field + " must be a number.")

    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError(field + " must be a number.")

    if value < minimum or value > maximum:
        raise ValueError(field + " is outside the allowed range.")

    return value


def valid_date(value, field):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError(field + " must use YYYY-MM-DD format.")


def error_response(message, status=400):
    return jsonify({
        "success": False,
        "error": message
    }), status


# ============== HEALTH CHECK ==============

@app.route("/api/health", methods=["GET"])
def health():

    return jsonify({
        "success": True,
        "message": "STOCKWISE backend is running!",
        "database": "SQLite",
        "time": datetime.now().isoformat(timespec="seconds")
    })


# ============== SALES MANAGEMENT ==============

@app.route("/api/sales", methods=["POST"])
def add_sale():

    try:
        data = read_json()

        product = required_text(data, "product_name")
        quantity_value = number(data, "quantity", 1, 1000000)

        if not quantity_value.is_integer():
            raise ValueError("Quantity must be a whole number.")

        quantity = int(quantity_value)

        sale_date = data.get(
            "sale_date",
            datetime.now().date().isoformat()
        )

        valid_date(sale_date, "sale_date")

        with get_db() as db:
            cursor = db.execute("""
                INSERT INTO sales
                (product_name, quantity, sale_date)
                VALUES (?, ?, ?)
            """, (product, quantity, sale_date))

            sale_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "message": "Sale recorded successfully.",
            "sale_id": sale_id
        }), 201

    except ValueError as exc:
        return error_response(str(exc))


@app.route("/api/sales", methods=["GET"])
def get_sales():

    with get_db() as db:
        rows = db.execute("""
            SELECT *
            FROM sales
            ORDER BY sale_date DESC, id DESC
            LIMIT 1000
        """).fetchall()

    return jsonify({
        "success": True,
        "sales": [dict(row) for row in rows]
    })


# ============== DEMO SALES DATA ==============

@app.route("/api/demo-sales", methods=["POST"])
def add_demo_sales():

    products = ["Laptop", "Mouse", "Keyboard", "Monitor"]
    today = datetime.now().date()

    with get_db() as db:

        for day in range(30):

            sale_date = (
                today - timedelta(days=29 - day)
            ).isoformat()

            for index, product in enumerate(products):

                quantity = 5 + ((day * (index + 2)) % 12)

                db.execute("""
                    INSERT INTO sales
                    (product_name, quantity, sale_date)
                    VALUES (?, ?, ?)
                """, (product, quantity, sale_date))

    return jsonify({
        "success": True,
        "message": "Demo sales added successfully.",
        "note": "These are simulated records, not actual sales."
    }), 201


# ============== DEMAND FORECASTING ==============

@app.route("/api/forecast", methods=["POST"])
def forecast():

    try:
        data = read_json()
        product = required_text(data, "product_name")

        with get_db() as db:

            rows = db.execute("""
                SELECT sale_date, SUM(quantity) AS quantity
                FROM sales
                WHERE product_name = ?
                GROUP BY sale_date
                ORDER BY sale_date
            """, (product,)).fetchall()

        if rows:
            sales = [float(row["quantity"]) for row in rows]
            source = "recorded_sales"

        else:
            daily_demand = number(
                data, "daily_demand", 0, 1000000
            )

            sales = [daily_demand] * 7
            source = "entered_daily_demand"

        recent = sales[-7:]
        weights = list(range(1, len(recent) + 1))

        weighted_average = sum(
            value * weight
            for value, weight in zip(recent, weights)
        ) / sum(weights)

        trend = 0

        if len(sales) >= 14:

            previous = mean(sales[-14:-7])
            current = mean(sales[-7:])

            if previous > 0:
                trend = (current - previous) / previous
                trend = max(-0.20, min(0.20, trend))

        daily_forecast = max(
            0,
            weighted_average * (1 + trend)
        )

        forecast_values = [
            round(daily_forecast, 2)
            for _ in range(7)
        ]

        errors = []

        if len(sales) >= 8:

            for index in range(7, len(sales)):

                history = sales[max(0, index - 7):index]
                predicted = mean(history)

                errors.append(
                    abs(sales[index] - predicted)
                )

        mae = round(mean(errors), 2) if errors else None

        return jsonify({
            "success": True,
            "product_name": product,
            "method": "Weighted Moving Average with trend adjustment",
            "source": source,
            "forecast_next_7_days": forecast_values,
            "average_daily_forecast": round(daily_forecast, 2),
            "backtest_mae": mae,
            "data_points": len(sales)
        })

    except ValueError as exc:
        return error_response(str(exc))


# ============== EOQ OPTIMIZER ==============

@app.route("/api/optimize", methods=["POST"])
def optimize():

    try:
        data = read_json()

        annual_demand = number(data, "annual_demand", 1)
        ordering_cost = number(data, "ordering_cost", 0.01)
        unit_cost = number(data, "unit_cost", 0.01)

        holding_rate = number(
            data, "holding_rate", 0.01, 100
        )

        daily_demand = number(data, "daily_demand", 0)
        lead_time = number(data, "lead_time", 0, 365)

        daily_std = number(data, "daily_std", 0)
        z_score = number(data, "z_score", 0, 5)

        holding_cost = unit_cost * holding_rate / 100

        eoq = (
            (2 * annual_demand * ordering_cost)
            / holding_cost
        ) ** 0.5

        safety_stock = (
            z_score * daily_std * (lead_time ** 0.5)
        )

        reorder_point = (
            daily_demand * lead_time + safety_stock
        )

        return jsonify({
            "success": True,
            "eoq": round(eoq, 2),
            "holding_cost_per_unit": round(holding_cost, 2),
            "safety_stock": round(safety_stock, 2),
            "reorder_point": round(reorder_point, 2),
            "suggested_order_quantity": round(eoq, 2),
            "formula": "EOQ = sqrt((2 x D x S) / H)",
            "note": "Based on the entered demand and cost assumptions."
        })

    except ValueError as exc:
        return error_response(str(exc))


# ============== SUPPLIER DELIVERY ==============

@app.route("/api/deliveries", methods=["POST"])
def add_delivery():

    try:
        data = read_json()

        supplier = required_text(data, "supplier_name")

        expected = valid_date(
            required_text(data, "expected_date"),
            "expected_date"
        )

        actual = valid_date(
            required_text(data, "actual_date"),
            "actual_date"
        )

        lead_time_value = number(
            data, "lead_time", 0, 3650
        )

        if not lead_time_value.is_integer():
            raise ValueError("Lead time must be a whole number.")

        lead_time = int(lead_time_value)

        with get_db() as db:

            cursor = db.execute("""
                INSERT INTO deliveries
                (supplier_name, expected_date, actual_date, lead_time)
                VALUES (?, ?, ?, ?)
            """, (
                supplier,
                expected.isoformat(),
                actual.isoformat(),
                lead_time
            ))

            delivery_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "message": "Supplier delivery recorded.",
            "delivery_id": delivery_id,
            "delay_days": max(0, (actual - expected).days)
        }), 201

    except ValueError as exc:
        return error_response(str(exc))


# ============== SUPPLIER SCORECARD ==============

@app.route("/api/supplier-scorecard", methods=["GET"])
def supplier_scorecard():

    with get_db() as db:

        rows = db.execute("""
            SELECT
                supplier_name,
                COUNT(*) AS total_deliveries,
                SUM(
                    CASE
                        WHEN actual_date <= expected_date
                        THEN 1 ELSE 0
                    END
                ) AS on_time_deliveries,
                AVG(
                    MAX(
                        0,
                        julianday(actual_date) -
                        julianday(expected_date)
                    )
                ) AS average_delay,
                AVG(lead_time) AS average_lead_time
            FROM deliveries
            GROUP BY supplier_name
            ORDER BY supplier_name
        """).fetchall()

    suppliers = []

    for row in rows:

        total = row["total_deliveries"]
        on_time = row["on_time_deliveries"]

        percentage = (
            on_time / total * 100
            if total else 0
        )

        suppliers.append({
            "supplier_name": row["supplier_name"],
            "total_deliveries": total,
            "on_time_deliveries": on_time,
            "on_time_percentage": round(percentage, 2),
            "average_delay_days": round(
                row["average_delay"] or 0, 2
            ),
            "average_lead_time_days": round(
                row["average_lead_time"] or 0, 2
            ),
            "prototype_score": round(percentage, 2)
        })

    return jsonify({
        "success": True,
        "suppliers": suppliers,
        "note": "Scores are based on recorded delivery data."
    })


# ============== DATABASE SUMMARY ==============

@app.route("/api/data-summary", methods=["GET"])
def data_summary():

    with get_db() as db:

        sales_count = db.execute(
            "SELECT COUNT(*) FROM sales"
        ).fetchone()[0]

        delivery_count = db.execute(
            "SELECT COUNT(*) FROM deliveries"
        ).fetchone()[0]

        product_count = db.execute(
            "SELECT COUNT(DISTINCT product_name) FROM sales"
        ).fetchone()[0]

    return jsonify({
        "success": True,
        "sales_records": sales_count,
        "delivery_records": delivery_count,
        "products_with_sales": product_count
    })


# ============== ERROR HANDLING ==============

@app.errorhandler(404)
def not_found(error):
    return error_response("API endpoint not found.", 404)


@app.errorhandler(500)
def server_error(error):
    logger.exception("Unexpected server error")
    return error_response("Internal server error.", 500)


# ============== START APPLICATION ==============

initialize_database()

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )
