#  Deploy a Todo App to Google Cloud Run

A complete beginner-friendly tutorial by **GDG On Campus Universiapolis · Agadir** — covering containerization with Docker and deployment on **Google Cloud Run**.

---

## Table of Contents

1. [What You'll Learn](#what-youll-learn)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Step 1 — Set Up GCP](#step-1--set-up-gcp)
5. [Step 2 — Run Locally](#step-2--run-locally)
6. [Step 3 — Containerize with Docker](#step-3--containerize-with-docker)
7. [Step 4 — Push to Artifact Registry](#step-4--push-to-artifact-registry)
8. [Step 5 — Deploy to Cloud Run](#step-5--deploy-to-cloud-run)
9. [Step 6 — Test Your Deployment](#step-6--test-your-deployment)
10. [Step 7 — Update & Redeploy](#step-7--update--redeploy)
11. [Step 8 — Clean Up](#step-8--clean-up)
12. [Troubleshooting](#troubleshooting)
13. [Next Steps](#next-steps)

---

## What You'll Learn

- How to set up a GCP project and configure the `gcloud` CLI
- How to write a minimal Python (Flask) web app with a REST API
- How to write a multi-stage `Dockerfile` and build a container image
- How to push your image to **Google Artifact Registry**
- How to deploy and manage a **Cloud Run** service
- How to handle zero-downtime updates and rollbacks

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Google Cloud SDK (`gcloud`) | Latest | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) |
| Docker | 20.10+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Python | 3.9+ | [python.org](https://www.python.org/downloads/) |
| Git | Any | [git-scm.com](https://git-scm.com/) |

You also need a **Google Cloud account** with billing enabled (free tier works).

---

## Project Structure

```
gcp-cloudrun-tutorial/
├── app/
│   ├── main.py               # Flask application + REST API
│   ├── requirements.txt      # Python dependencies
│   ├── templates/
│   │   └── index.html        # Main UI (Google / GDG colors)
│   └── static/
│       ├── css/style.css     # Styling
│       └── js/app.js         # Frontend JS (talks to the API)
├── Dockerfile                # Multi-stage container definition
├── .dockerignore             # Files excluded from Docker build
├── .gcloudignore             # Files excluded from gcloud uploads
├── .gitignore
└── README.md
```

---

## Step 1 — Set Up GCP

### 1.1 Create a GCP Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project → New Project**
3. Name it (e.g. `cloudrun-demo`) and note the **Project ID**

>  The **Project ID** is unique and may differ from the display name. You'll use it in every `gcloud` command below.

### 1.2 Authenticate and configure the CLI

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region europe-west1   # change to your nearest region
```

### 1.3 Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## Step 2 — Run Locally

```bash
# Clone the repo
git clone https://github.com/abdelhak-kadir/gdgoc_gcp_tuto.git
cd gcp-cloudrun-tutorial

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r app/requirements.txt

# Run the app
cd app
python main.py
```

Open [http://localhost:8080](http://localhost:8080) — you should see the GDG Todo app.

**REST API endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create a task `{"text":"…","priority":"high"}` |
| `PATCH` | `/api/tasks/<id>` | Update a task `{"done":true}` |
| `DELETE` | `/api/tasks/<id>` | Delete a task |
| `DELETE` | `/api/tasks/clear-done` | Delete all completed tasks |
| `GET` | `/health` | Health check |

---

## Step 3 — Containerize with Docker

### 3.1 Build the image

```bash
# From the project root
docker build -t gdg-todo .
```

### 3.2 Run locally with Docker

```bash
docker run -p 8080:8080 gdg-todo
```

Visit [http://localhost:8080](http://localhost:8080) to verify the containerized app works.

> The `Dockerfile` uses a **multi-stage build** to keep the final image small — only runtime dependencies are included.

---

## Step 4 — Build & Push to Artifact Registry

### 4.1 Create a Docker repository

```bash
gcloud artifacts repositories create cloudrun-repo \
  --repository-format=docker \
  --location=europe-west1 \
  --description="GDG Todo app images"
```

### 4.2 Define the image path

```bash
export IMAGE=europe-west1-docker.pkg.dev/YOUR_PROJECT_ID/cloudrun-repo/gdg-todo:v1
```

### 4.3 Build and push with Cloud Build

Instead of running `docker build` + `docker push` locally (which can fail in Cloud Shell due to networking issues), use **Cloud Build** — it builds and pushes the image entirely on GCP's infrastructure:

```bash
gcloud builds submit --tag $IMAGE .
```

That's it — one command handles the build and the push. 

> **Why not `docker push` directly?**  
> In Cloud Shell, Docker connections to Artifact Registry can be refused due to session credential expiry. `gcloud builds submit` sends your source code to Cloud Build, which builds and pushes the image server-side, bypassing the issue entirely.

### 4.4 Verify the image was pushed

```bash
gcloud artifacts docker images list \
  europe-west1-docker.pkg.dev/YOUR_PROJECT_ID/cloudrun-repo
```

---

## Step 5 — Deploy to Cloud Run

```bash
gcloud run deploy gdg-todo \
  --image $IMAGE \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5
```

**Flag breakdown:**

| Flag | Description |
|---|---|
| `--allow-unauthenticated` | Make the service publicly accessible |
| `--min-instances 0` | Scale to zero when idle (cost-saving) |
| `--max-instances 5` | Cap auto-scaling |
| `--memory 256Mi` | RAM per container instance |

After deployment the CLI prints the **Service URL** — copy it.

---

## Step 6 — Test Your Deployment

```bash
# Open in browser
open https://gdg-todo-xxxxxxxx-ew.a.run.app

# Health check
curl https://gdg-todo-xxxxxxxx-ew.a.run.app/health

# Create a task via the API
curl -X POST https://gdg-todo-xxxxxxxx-ew.a.run.app/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"text":"Test from Cloud Run!","priority":"high"}'
```

### View logs

```bash
gcloud run services logs read gdg-todo --region europe-west1
```

---

## Step 7 — Update & Redeploy

Make a code change, then:

```bash
export IMAGE_V2=europe-west1-docker.pkg.dev/YOUR_PROJECT_ID/cloudrun-repo/gdg-todo:v2

# Build and push via Cloud Build
gcloud builds submit --tag $IMAGE_V2 .

# Deploy the new image
gcloud run deploy gdg-todo \
  --image $IMAGE_V2 \
  --region europe-west1
```

Cloud Run performs a **zero-downtime rollout**.

### Rollback to a previous revision

```bash
# List revisions
gcloud run revisions list --service gdg-todo --region europe-west1

# Route 100% traffic to a specific revision
gcloud run services update-traffic gdg-todo \
  --region europe-west1 \
  --to-revisions REVISION_NAME=100
```

---

## Step 8 — Clean Up

```bash
# Delete the Cloud Run service
gcloud run services delete gdg-todo --region europe-west1

# Delete the Artifact Registry repo (and all images)
gcloud artifacts repositories delete cloudrun-repo \
  --location europe-west1

# (Optional) Delete the entire project
gcloud projects delete YOUR_PROJECT_ID
```

---

## Troubleshooting

###  Permission denied when deploying

Make sure your account has the required roles:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="user:YOUR_EMAIL" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="user:YOUR_EMAIL" \
  --role="roles/artifactregistry.writer"
```

### Container failed to start

Cloud Run requires your app to listen on `$PORT` within 4 minutes.

```bash
# Check startup logs
gcloud run services logs read gdg-todo --region europe-west1 --limit 50
```

###  docker push: unauthorized

```bash
gcloud auth configure-docker europe-west1-docker.pkg.dev
```

###  API not enabled error

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

---

## Next Steps

- **Custom domains** — [Map your own domain](https://cloud.google.com/run/docs/mapping-custom-domains)
- **Environment variables** — `--set-env-vars KEY=VALUE`
- **Secrets** — Use [Secret Manager](https://cloud.google.com/secret-manager) for API keys and credentials
- **Persistent storage** — Replace the in-memory task store with [Firestore](https://cloud.google.com/firestore) or [Cloud SQL](https://cloud.google.com/sql)
- **CI/CD** — Automate builds and deploys with [Cloud Build triggers](https://cloud.google.com/build/docs/triggers)
- **VPC** — Connect Cloud Run to private databases

---

## 📎 Useful Links

- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Artifact Registry Docs](https://cloud.google.com/artifact-registry/docs)
- [gcloud CLI Reference](https://cloud.google.com/sdk/gcloud/reference)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [GCP Free Tier](https://cloud.google.com/free)

---

<div align="center">
  <img src="https://img.shields.io/badge/GDG%20On%20Campus-Universiapolis-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="GDG On Campus Universiapolis" />
  <br/>
  <sub>Made with  by GDG On Campus Universiapolis · Agadir</sub>
</div>
