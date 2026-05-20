package com.ruleengine.domain;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "pathway_stage")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PathwayStage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pathway_id", nullable = false)
    private Long pathwayId;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "code", nullable = false, length = 64)
    private String code;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(name = "description", length = 512)
    private String description;

    @Column(name = "exit_rule_code", length = 64)
    private String exitRuleCode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
