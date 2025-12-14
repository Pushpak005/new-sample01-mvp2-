#!/usr/bin/env bash
set -euo pipefail

echo "Creating backend folders..."
mkdir -p demo/fast-start/backend/src/main/java/com/acl25/demo/model
mkdir -p demo/fast-start/backend/src/main/java/com/acl25/demo/repo
mkdir -p demo/fast-start/backend/src/main/java/com/acl25/demo/controller
mkdir -p demo/fast-start/backend/src/main/resources/db/migration
mkdir -p demo/fast-start/backend/src/main/resources/data

echo "Writing pom.xml..."
cat > demo/fast-start/backend/pom.xml <<'EOF'
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.acl25</groupId>
  <artifactId>demo-backend</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <packaging>jar</packaging>

  <name>demo-backend</name>

  <properties>
    <java.version>17</java.version>
    <spring.boot.version>3.1.5</spring.boot.version>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <maven.compiler.source>${java.version}</maven.compiler.source>
    <maven.compiler.target>${java.version}</maven.compiler.target>
    <finalName>demo-backend-0.0.1-SNAPSHOT</finalName>
  </properties>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>${spring.boot.version}</version>
    <relativePath/> 
  </parent>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <dependency>
      <groupId>org.flywaydb</groupId>
      <artifactId>flyway-core</artifactId>
    </dependency>

    <dependency>
      <groupId>com.h2database</groupId>
      <artifactId>h2</artifactId>
      <scope>runtime</scope>
    </dependency>

    <dependency>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-databind</artifactId>
    </dependency>

    <dependency>
      <groupId>com.fasterxml.jackson.core</groupId>
      <artifactId>jackson-core</artifactId>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
        <configuration>
          <excludes>
          </excludes>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
EOF

echo "Writing DemoApplication.java..."
cat > demo/fast-start/backend/src/main/java/com/acl25/demo/DemoApplication.java <<'EOF'
package com.acl25.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {
  public static void main(String[] args) {
    SpringApplication.run(DemoApplication.class, args);
  }
}
EOF

echo "Writing Recommendation.java..."
cat > demo/fast-start/backend/src/main/java/com/acl25/demo/model/Recommendation.java <<'EOF'
package com.acl25.demo.model;

import jakarta.persistence.*;

@Entity
@Table(name = "recommendations")
public class Recommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private Integer calories;

    @Column(length = 1000)
    private String description;

    public Recommendation() {}

    public Recommendation(String name, Integer calories, String description) {
        this.name = name;
        this.calories = calories;
        this.description = description;
    }

    // getters / setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Integer getCalories() { return calories; }
    public void setCalories(Integer calories) { this.calories = calories; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
EOF

echo "Writing RecommendationRepository.java..."
cat > demo/fast-start/backend/src/main/java/com/acl25/demo/repo/RecommendationRepository.java <<'EOF'
package com.acl25.demo.repo;

import com.acl25.demo.model.Recommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RecommendationRepository extends JpaRepository<Recommendation, Long> {
}
EOF

echo "Writing RecommendationController.java..."
cat > demo/fast-start/backend/src/main/java/com/acl25/demo/controller/RecommendationController.java <<'EOF'
package com.acl25.demo.controller;

import com.acl25.demo.model.Recommendation;
import com.acl25.demo.repo.RecommendationRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
@CrossOrigin(origins = "*")
public class RecommendationController {

    private final RecommendationRepository repo;

    public RecommendationController(RecommendationRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<Recommendation> getAll() {
        return repo.findAll();
    }

    @PostMapping
    public ResponseEntity<Recommendation> create(@RequestBody Recommendation r) {
        Recommendation saved = repo.save(r);
        return ResponseEntity.ok(saved);
    }
}
EOF

echo "Writing DataSeeder.java..."
cat > demo/fast-start/backend/src/main/java/com/acl25/demo/DataSeeder.java <<'EOF'
package com.acl25.demo;

import com.acl25.demo.model.Recommendation;
import com.acl25.demo.repo.RecommendationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

@Component
public class DataSeeder implements CommandLineRunner {

    private final RecommendationRepository repo;
    private final ObjectMapper mapper = new ObjectMapper();

    public DataSeeder(RecommendationRepository repo) {
        this.repo = repo;
    }

    @Override
    public void run(String... args) throws Exception {
        if (repo.count() > 0) return; // don't reseed

        JsonNode root = null;

        // Try resource path first
        ClassPathResource r = new ClassPathResource("data/food_catalog.json");
        if (r.exists()) {
            try (InputStream is = r.getInputStream()) {
                root = mapper.readTree(is);
            }
        } else {
            // fallback: repo root copy
            Path p = Path.of("food_catalog.json");
            if (Files.exists(p)) {
                root = mapper.readTree(p.toFile());
            }
        }

        if (root != null && root.isArray()) {
            for (JsonNode node : root) {
                String name = node.has("name") ? node.get("name").asText() : node.path("title").asText("");
                Integer calories = node.has("calories") ? node.get("calories").asInt() : null;
                String desc = node.has("description") ? node.get("description").asText() : "";
                Recommendation rec = new Recommendation(name, calories, desc);
                repo.save(rec);
            }
        }
    }
}
EOF

echo "Writing application.properties..."
cat > demo/fast-start/backend/src/main/resources/application.properties <<'EOF'
spring.datasource.url=jdbc:h2:mem:demo;DB_CLOSE_DELAY=-1
spring.datasource.driverClassName=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.show-sql=true
spring.jpa.hibernate.ddl-auto=none
spring.flyway.enabled=true
spring.flyway.locations=classpath:db/migration
logging.level.org.springframework=INFO
server.port=8080
EOF

echo "Writing Flyway migration V1__create_recommendations.sql..."
cat > demo/fast-start/backend/src/main/resources/db/migration/V1__create_recommendations.sql <<'EOF'
CREATE TABLE recommendations (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name VARCHAR(255),
  calories INT,
  description VARCHAR(1000)
);
EOF

echo "Writing Dockerfile..."
cat > demo/fast-start/backend/Dockerfile <<'EOF'
FROM eclipse-temurin:17-jdk
ARG JAR_FILE=target/demo-backend-0.0.1-SNAPSHOT.jar
COPY ${JAR_FILE} /app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
EOF

<<<<<<< HEAD
echo "All backend files created."
=======
echo "All backend files created."
>>>>>>> origin/main
