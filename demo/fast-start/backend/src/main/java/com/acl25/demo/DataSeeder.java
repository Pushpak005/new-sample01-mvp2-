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
