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
