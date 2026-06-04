import json
import math
import mimetypes
import ast
import operator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
HOST = "127.0.0.1"
PORT = 8001


class Calculator:
    def __init__(self):
        self.current_number = 0.0
        self.history = []

    def state(self):
        return {
            "current_number": self.current_number,
            "history": self.history[-20:],
        }

    def add_history(self, line):
        self.history.append(line)

    def calculate(self, operation, value=None):
        old = self.current_number

        if operation == "set":
            self.current_number = require_number(value)
        elif operation == "add":
            num = require_number(value)
            self.current_number += num
            self.add_history(f"{old} + {num} = {self.current_number}")
        elif operation == "subtract":
            num = require_number(value)
            self.current_number -= num
            self.add_history(f"{old} - {num} = {self.current_number}")
        elif operation == "multiply":
            num = require_number(value)
            self.current_number *= num
            self.add_history(f"{old} * {num} = {self.current_number}")
        elif operation == "divide":
            num = require_number(value)
            if num == 0:
                raise ValueError("Cannot divide by zero")
            self.current_number /= num
            self.add_history(f"{old} / {num} = {self.current_number}")
        elif operation == "percentage":
            self.current_number = self.current_number / 100
            self.add_history(f"{old}% = {self.current_number}")
        elif operation == "sqrt":
            if self.current_number < 0:
                raise ValueError("Square root needs zero or a positive number")
            self.current_number = math.sqrt(self.current_number)
            self.add_history(f"sqrt({old}) = {self.current_number}")
        elif operation == "square":
            self.current_number = self.current_number ** 2
            self.add_history(f"{old}^2 = {self.current_number}")
        elif operation == "evaluate":
            expression = str(value)
            self.current_number = evaluate_expression(expression)
            self.add_history(f"{expression} = {self.current_number}")
        elif operation == "clear_history":
            self.history.clear()
        else:
            raise ValueError("Unknown calculator operation")

        return self.state()


def require_number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError("Please enter a valid number") from None


def evaluate_expression(expression):
    allowed_operators = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }

    def solve(node):
        if isinstance(node, ast.Expression):
            return solve(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in allowed_operators:
            return allowed_operators[type(node.op)](solve(node.left), solve(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in allowed_operators:
            return allowed_operators[type(node.op)](solve(node.operand))
        raise ValueError("Only numbers, +, -, *, /, and parentheses are allowed")

    try:
        parsed = ast.parse(expression, mode="eval")
        return solve(parsed)
    except ZeroDivisionError:
        raise ValueError("Cannot divide by zero") from None
    except (SyntaxError, ValueError):
        raise ValueError("Please enter a valid calculation") from None


calculator = Calculator()


class CalculatorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/":
            self.serve_file(STATIC_DIR / "index.html")
        elif self.path == "/api/state":
            self.send_json({"ok": True, "state": calculator.state()})
        elif self.path.startswith("/static/"):
            relative_path = unquote(self.path.removeprefix("/static/"))
            requested = (STATIC_DIR / relative_path).resolve()
            static_root = STATIC_DIR.resolve()

            if static_root not in requested.parents and requested != static_root:
                self.send_error(403)
                return

            self.serve_file(requested)
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/api/calculate":
            self.send_error(404)
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            state = calculator.calculate(payload.get("operation"), payload.get("value"))
            self.send_json({"ok": True, "state": state})
        except ValueError as error:
            self.send_json({"ok": False, "error": str(error), "state": calculator.state()}, status=400)
        except OverflowError:
            self.send_json(
                {"ok": False, "error": "That result is too large for Python to calculate.", "state": calculator.state()},
                status=400,
            )

    def serve_file(self, path):
        if not path.exists() or not path.is_file():
            self.send_error(404)
            return

        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        content = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, payload, status=200):
        content = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), CalculatorHandler)
    print(f"Calculator website running at http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop the server.")
    server.serve_forever()
