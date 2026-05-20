package com.ruleengine.domain;

import com.ruleengine.domain.enums.PathwayStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "clinical_pathway")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClinicalPathway {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", unique = true, nullable = false, length = 64)
    private String code;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "description", length = 512)
    private String description;

    @Column(name = "version", length = 16)
    private String version = "1.0.0";

    @Column(name = "status", nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    private PathwayStatus status = PathwayStatus.DRAFT;

    @Column(name = "indication", length = 512)
    private String indication;

    @Column(name = "admission_rule_code", length = 64)
    private String admissionRuleCode;

    @Column(name = "process_def_id")
    private Long processDefId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
