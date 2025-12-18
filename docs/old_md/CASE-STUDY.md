# CASE STUDY — Quick demo

What I changed:
- Added CI caching and a demo workflow that builds the backend and runs an ETL smoke check.
- Added Dockerfile (backend) and a simple Python ETL demo.

How to demo locally:
1. Build backend jar:
   mvn -f demo/fast-start/backend/pom.xml clean package
2. Build Docker image:
   docker build -t new-sample-backend -f demo/fast-start/backend/Dockerfile .
3. Run container:
   docker run --rm -p 8080:8080 new-sample-backend
4. Run ETL:
   python3 scripts/run_etl.py
