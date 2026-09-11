from __future__ import annotations

import os
import re
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, request

app = Flask(__name__)
TASKS_FILE = Path(__file__).with_name("tasks.md")
VALID_STATUSES = {"todo", "in-progress", "done"}
VALID_PRIORITIES = {"low", "medium", "high"}


def parse_tasks(markdown: str) -> list[dict]:
    tasks = []
    for block in re.split(r"^## ", markdown, flags=re.MULTILINE)[1:]:
        lines = block.strip().splitlines()
        fields = {}
        for line in lines[1:]:
            if line.startswith("- ") and ":" in line:
                key, value = line[2:].split(":", 1)
                fields[key.strip()] = value.strip()
        status = fields.get("status", "todo")
        priority = fields.get("priority", "medium")
        tasks.append({
            "id": fields.get("id", str(uuid4())),
            "title": lines[0].strip(),
            "description": fields.get("description", ""),
            "status": status if status in VALID_STATUSES else "todo",
            "priority": priority if priority in VALID_PRIORITIES else "medium",
            "due": fields.get("due", ""),
            "tags": [tag.strip() for tag in fields.get("tags", "").split(",") if tag.strip()],
        })
    return tasks


def serialize_tasks(tasks: list[dict]) -> str:
    blocks = []
    for task in tasks:
        blocks.append(
            f"## {task['title']}\n"
            f"- id: {task['id']}\n"
            f"- status: {task['status']}\n"
            f"- priority: {task['priority']}\n"
            f"- due: {task['due']}\n"
            f"- tags: {', '.join(task['tags'])}\n"
            f"- description: {task['description'].replace(chr(10), ' ')}\n"
        )
    return "# Task Ledger\n\n<!-- Tasks are managed by the app. You can also edit this file directly. -->\n\n" + "\n".join(blocks)


def read_tasks() -> list[dict]:
    return parse_tasks(TASKS_FILE.read_text(encoding="utf-8"))


def write_tasks(tasks: list[dict]) -> None:
    TASKS_FILE.write_text(serialize_tasks(tasks), encoding="utf-8")


def normalize_task(payload: dict, existing: dict | None = None) -> dict:
    existing = existing or {}
    status = payload.get("status", existing.get("status", "todo"))
    priority = payload.get("priority", existing.get("priority", "medium"))
    tags = payload.get("tags", existing.get("tags", []))
    return {
        "id": existing.get("id", payload.get("id", str(uuid4()))),
        "title": str(payload.get("title", existing.get("title", ""))).strip(),
        "description": str(payload.get("description", existing.get("description", ""))).strip(),
        "status": status if status in VALID_STATUSES else existing.get("status", "todo"),
        "priority": priority if priority in VALID_PRIORITIES else existing.get("priority", "medium"),
        "due": str(payload.get("due", existing.get("due", ""))),
        "tags": [str(tag).strip() for tag in tags if str(tag).strip()],
    }


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.get("/api/tasks")
def get_tasks():
    return jsonify(read_tasks())


@app.post("/api/tasks")
def create_task():
    task = normalize_task(request.get_json(silent=True) or {})
    if not task["title"]:
        return jsonify(error="Title is required"), 400
    tasks = read_tasks()
    tasks.insert(0, task)
    write_tasks(tasks)
    return jsonify(task), 201


@app.put("/api/tasks/<task_id>")
def update_task(task_id: str):
    tasks = read_tasks()
    index = next((index for index, task in enumerate(tasks) if task["id"] == task_id), None)
    if index is None:
        return jsonify(error="Task not found"), 404
    task = normalize_task(request.get_json(silent=True) or {}, tasks[index])
    if not task["title"]:
        return jsonify(error="Title is required"), 400
    tasks[index] = task
    write_tasks(tasks)
    return jsonify(task)


@app.delete("/api/tasks/<task_id>")
def delete_task(task_id: str):
    tasks = read_tasks()
    remaining = [task for task in tasks if task["id"] != task_id]
    if len(remaining) == len(tasks):
        return jsonify(error="Task not found"), 404
    write_tasks(remaining)
    return "", 204


@app.get("/api/report")
def get_report():
    tasks = read_tasks()
    today = date.today()
    week_end = today + timedelta(days=7)
    active = [task for task in tasks if task["status"] != "done"]
    def has_due_between(task: dict, start: date, end: date) -> bool:
        if not task["due"]:
            return False
        try:
            due = date.fromisoformat(task["due"])
        except ValueError:
            return False
        return start <= due <= end

    return jsonify({
        "total": len(tasks),
        "done": sum(task["status"] == "done" for task in tasks),
        "inProgress": sum(task["status"] == "in-progress" for task in tasks),
        "overdue": sum(bool(task["due"]) and task["due"] < today.isoformat() for task in active),
        "dueSoon": sum(has_due_between(task, today, week_end) for task in active),
        "byPriority": {priority: sum(task["priority"] == priority for task in tasks) for priority in VALID_PRIORITIES},
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "3001")), debug=True)