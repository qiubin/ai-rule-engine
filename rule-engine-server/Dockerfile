# 后端 Dockerfile — Spring Boot
# 用法: docker build -t rule-engine-server .

FROM eclipse-temurin:8-jdk AS builder

WORKDIR /app
COPY .mvn ./.mvn
COPY mvnw pom.xml ./
COPY src ./src
RUN ./mvnw clean package -DskipTests -q

FROM eclipse-temurin:8-jre

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8082

ENV MYSQL_HOST=192.168.2.166 \
    MYSQL_PORT=3306 \
    MYSQL_DB=ruleengine \
    MYSQL_USER=root \
    MYSQL_PASSWORD=zoeddc@2017 \
    JAVA_OPTS=""

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
