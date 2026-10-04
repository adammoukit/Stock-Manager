# Multi-stage Dockerfile pour Spring Boot (Java 21)
# Étape 1 : Build
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
COPY src src
# Build de l'application sans exécuter les tests pendant l'image packaging
RUN ./mvnw clean package -DskipTests || true

# Étape 2 : Runtime léger (JRE)
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
# Port standard Spring Boot
EXPOSE 8080
# Création d'un utilisateur non-root pour des raisons de sécurité industrielle
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copie du jar produit
COPY target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
