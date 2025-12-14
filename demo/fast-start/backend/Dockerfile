# Multi-stage Dockerfile for Maven/Java backend
FROM maven:3.8.6-eclipse-temurin-17 AS build
WORKDIR /app
# Copy pom first to leverage Docker cache for dependencies
COPY demo/fast-start/backend/pom.xml /app/pom.xml
COPY demo/fast-start/backend/src /app/src
RUN mvn -B -DskipTests clean package

FROM eclipse-temurin:17-jre
WORKDIR /app
# Copy built jar (wildcard to match versioned jar)
COPY --from=build /app/target/*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
