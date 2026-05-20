package com.ruleengine.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "rule_execution_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RuleExecutionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rule_id", nullable = false)
    private Long ruleId;

    @Column(name = "rule_code", length = 64)
    private String ruleCode;

    @Column(name = "rule_version", length = 16)
    private String ruleVersion;

    @Column(name = "params_json", columnDefinition = "LONGTEXT")
    private String paramsJson;

    @Column(name = "output_json", columnDefinition = "LONGTEXT")
    private String outputJson;

    @Column(name = "hit_node_ids", columnDefinition = "LONGTEXT")
    private String hitNodeIds;

    @Column(name = "fired_count")
    private Integer firedCount;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "status", length = 16, nullable = false)
    private String status; // SUCCESS, NO_HIT, ERROR

    @Column(name = "error_message", columnDefinition = "LONGTEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "executed_at", updatable = false)
    private LocalDateTime executedAt;
}
