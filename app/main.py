import os
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# In-memory task store (resets on container restart)
# For production, replace with Firestore or Cloud SQL
tasks = [
    {"id": 1, "text": "Prepare Cloud Run workshop slides", "priority": "high",   "done": False},
    {"id": 2, "text": "Review GDG event budget proposal",  "priority": "medium", "done": False},
    {"id": 3, "text": "Set up Firebase demo project",      "priority": "high",   "done": False},
    {"id": 4, "text": "Post event recap on social media",  "priority": "low",    "done": True},
    {"id": 5, "text": "Collect RSVP list for next meetup", "priority": "medium", "done": False},
]
next_id = 6


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    return jsonify(tasks)


@app.route("/api/tasks", methods=["POST"])
def create_task():
    global next_id
    data = request.get_json()
    text = (data.get("text") or "").strip()
    priority = data.get("priority", "medium")

    if not text:
        return jsonify({"error": "Task text is required"}), 400
    if priority not in ("high", "medium", "low"):
        return jsonify({"error": "Invalid priority"}), 400

    task = {"id": next_id, "text": text, "priority": priority, "done": False}
    next_id += 1
    tasks.insert(0, task)
    return jsonify(task), 201


@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    data = request.get_json()
    if "done" in data:
        task["done"] = bool(data["done"])
    return jsonify(task)


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):

    global tasks
    original_len = len(tasks)
    tasks = [t for t in tasks if t["id"] != task_id]
    if len(tasks) == original_len:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"deleted": task_id})


@app.route("/api/tasks/clear-done", methods=["DELETE"])
def clear_done():
    global tasks
    tasks = [t for t in tasks if not t["done"]]
    return jsonify({"status": "ok"})


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "gdg-todo"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)