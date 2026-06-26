# syntax=docker/dockerfile:1

# ---------- build stage ----------
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

# Resolve dependencies first so this layer is cached across code-only changes.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline

# Build the application jar.
COPY src/ src/
RUN ./mvnw -q -B clean package -Dmaven.test.skip=true

# ---------- run stage ----------
# If the "25-jre" tag is unavailable in your registry, use "eclipse-temurin:25-jdk".
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/target/pulse-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]